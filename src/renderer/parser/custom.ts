import {TextToValue, TextSpec} from '../frontend/index';
import * as nearley from './nearley';
import {Grammar} from 'nearley';
import * as _ from 'underscore';
import {Result} from '../util'

/**
 * Object used throughout the conversion to keep track of state
 */
interface GrammarCreationContext {
    functions: {[key: string] : string},
    rulesByName: {[key: string] : string},
    namesByRule: {[rule: string] : string},
    childRulesByName: {[key: string] : any},
    charsetsSoFar: {[charset: string] : string}
}

const getNewContext = () : GrammarCreationContext => {
    return {
        functions: {},
        rulesByName: {},
        childRulesByName: {},
        charsetsSoFar: {},
        namesByRule: {}
    }
}

const generateFunctions = (context: GrammarCreationContext) => {
    return `@{%\n${_.values(context.functions).map(f => f.toString()).join('\n')}%}\n\n`
}

const getChildRuleName = (context: GrammarCreationContext, parentRule?: string) => {
    const parentName = parentRule ? parentRule : 'rule';
    context.childRulesByName[parentName] = (context.childRulesByName[parentName] || 0) + 1;
    return parentName + context.childRulesByName[parentName];
}

const generateChildRules = (context: GrammarCreationContext) => {
    const rules = [];
    _.keys(context.rulesByName as any).forEach(key => {
        rules.push(`${key} -> ${context.rulesByName[key]}\n\n`);
    });
    return rules.join('\n');
} 

const asNewRule = (rule: string, context: GrammarCreationContext, newRule: boolean, parentRule?: string) => {
    // if (!newRule) {
    //     return rule;
    // }
    const newRuleName = getChildRuleName(context, parentRule)
    context.rulesByName[newRuleName] = rule; 
    return newRuleName;
}

const cached: {[key: string] : (input: string) => Result<any>} = {};
export const parseSpecCached = (spec: TextSpec, input: string, cacheId: string) : Result<any> => {
    if (!cached[cacheId]) {
        cached[cacheId] = specParser(spec);
    }

    return cached[cacheId](input);
}  

export const specParser = (spec: TextSpec) : (input: string) => Result<any> => {
    let grammar = "";
    const creationContext = getNewContext();

    if (typeof(spec) === 'string') {
        // the rule generated otherwise would just be a string rather than a rule name,
        // just return a simple match rule
        grammar += `rule -> "${sanitizeString(spec)}"`;
    }
    else {  
        const rule = newGetRuleDefinitionForTextSpec(spec, creationContext, 0);
        
        grammar += "@{% ";
        
        
        _.keys(creationContext.functions).forEach(key => {
            grammar += `function ${key}(data, location, reject) {return window._livelangNearley.${key}(data, location, reject)} `
        });
        grammar += "%}\n\n";

        // Make sure our first rule comes first
        grammar += `${rule} -> ${creationContext.rulesByName[rule]}\n\n`;
        delete creationContext.rulesByName[rule];

        grammar += generateChildRules(creationContext);
    }

    const compiled = nearley.compileGrammar(grammar);

    return (input: string) => {
        // We need to assign these functions every time as they get overwritten with each
        // successive call
        (window as any)._livelangNearley = creationContext.functions;
        return nearley.parse(compiled.result, input);
    }
}

export const parseSpec = (spec: TextSpec, input: string) => specParser(spec)(input);

export const generateNearleyGrammarFromSpec = (spec: TextSpec) : string => {

    const creationContext = getNewContext();    
    const rule = newGetRuleDefinitionForTextSpec(spec, creationContext, null);
    
    let grammar = "";
    grammar += generateFunctions(creationContext);
    grammar += generateChildRules(creationContext);

    return grammar;
}

export const callFunction = (func: any, context: GrammarCreationContext) => {
    const keys = _.keys(context.functions);
    let funcName = 'func' + (keys.length + 1);

    // If the function already exists, don't create another one
    for (let i = 0; i < keys.length; i++) {
        if (context.functions[keys[i]] === func) {
            funcName = keys[i];
            break;
        } 
    }

    context.functions[funcName] = func;
    return `{% function(data, location, reject) {return ${funcName}(data, location, reject);} %}`;
};

export const sanitizeString = str => str.replace(/"/g, '\\"'); 

export const newGetRuleDefinitionForTextSpec = (spec: TextSpec, context: GrammarCreationContext, depthFromNode: number, parentRule?: TextSpec) : string => {
    const asAny = spec as any;

    // Should return as a single element or null
    if (typeof(spec) === 'string') {
        // String literal
        return `"${sanitizeString(spec as string)}"`;
    }
    else if (spec instanceof RegExp) {
        console.error('RegExp not supported for nearley grammar');
    }
    else if (asAny.charset) {
        return asNewRule(`[${asAny.charset}]`, context, false);
    }
    else if (asAny.or) {
        // One of a choice of spec
        const or = asAny.or as TextSpec[];
        const rule = '(' + or.map(spec => newGetRuleDefinitionForTextSpec(spec, context, depthFromNode)).join(' | ') + ')';
        return asNewRule(rule, context, depthFromNode <= 1);
    }
    else if (asAny['?']) {
        // All spec in a row
        const rule = newGetRuleDefinitionForTextSpec(_.values(asAny)[0], context, depthFromNode + 1, asAny) + ':?';
        return asNewRule(rule, context, true);
    }

    // Following should return as arrays
    else if (asAny.all) {
        // All components in a row
        const all = asAny.all as TextSpec[];
        const rule = '(' + all.map(component => newGetRuleDefinitionForTextSpec(component, context, depthFromNode + 1)).join(' ') + ')';
        return asNewRule(rule, context, true);
    }
    else if (asAny['*']) {
        const rule = newGetRuleDefinitionForTextSpec(_.values(asAny)[0], context, depthFromNode + 1, asAny) + ':*';
        return asNewRule(rule, context, true);
    }
    else if (asAny['+']) {
        const rule = newGetRuleDefinitionForTextSpec(_.values(asAny)[0], context, depthFromNode + 1, asAny) + ':+';
        return asNewRule(rule, context, true);
    }    

    // Should return as a node
    else if ((spec as TextToValue<any>).id) {

        const description = spec as TextToValue<any>;
        if (context.rulesByName[description.id]) {
            return description.id;
        }
        
        // Incase we call ourselves recursively, only text descriptions can
        // do that as they're object references
        context.rulesByName[description.id] = 'inProgress';

        function processParsedValue(data: any, location: number) {
            const value = description.valueFromComponents(data)

            // sometimes the same thing gets processed twice which is super weird but we end up
            // processing this value itself as its own source, which leads to overwriting its length/end,
            // resulting in NaN and all sorts..
            if (value.source) return value;

            value.source = {}
            value.source.start = location
            const flattened = _.flatten(data);
            const objs = flattened.filter(o => typeof(o) === 'object' && o != null);
            const childLengths = objs.reduce((prev, curr) => prev + curr.source.length, 0);
            const strs = flattened.filter(s => typeof(s) === 'string');
            value.source.length = strs.join('').length + childLengths;
            value.source.end = value.source.start + value.source.length
            return value;
        }

        // Assume it's a node text description object
        const rule = description.getTextSpecs().map(spec => 
            newGetRuleDefinitionForTextSpec(spec, context, 0, description)
        ).join(' ') + ' ' + callFunction(processParsedValue, context);

        context.rulesByName[description.id] = rule;
        return asNewRule(rule, context, false);
    }
    
};