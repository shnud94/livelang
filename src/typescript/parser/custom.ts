import {NodeTextDescription, NodeTextSpec} from '../frontend/index';
import * as nearley from './nearley';
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

export function flatten<T>(data: Array<T>, depth: number = -1) {
    if (!Array.isArray(data)) return data;

    return data.reduce(function(acc, val) {
        return acc.concat(Array.isArray(val) ? flatten(val as any as Array<T>, depth - 1) : val);
    }, []);
}

export function flattenJoin<T>(data: Array<T>, depth: number = -1) : string {
    if (!Array.isArray(data)) return data as any;

    return data.reduce(function(acc, val) {
        return acc.concat(Array.isArray(val) ? flatten(val as any as Array<T>, depth - 1) : val);
    }, []).join('');
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

export const generateNearleyGrammarFromTextSpec = (name: string, spec: NodeTextSpec) : string => {

    let creationContext = getNewContext();

    generateNearleyRulesFromTextSpecs(name, [spec], creationContext, name);
    let grammar = "";
    // By this point, rules by name should have all rules in it
    _.keys(creationContext.rulesByName as any).forEach(key => {
        grammar += `${key} -> ${creationContext.rulesByName[key]}\n\n`;
    });

    return grammar;
}

export const generateNearleyGrammar = (description: NodeTextDescription<any>) : string => {
    
    let creationContext = getNewContext();

    generateNearleyRulesFromTextSpecs(description.id, description.getTextSpecs(), creationContext, description.id);

    let grammar = "";
    // By this point, rules by name should have all rules in it
    _.keys(creationContext.rulesByName as any).forEach(key => {
        grammar += `${key} -> ${creationContext.rulesByName[key]}\n\n`;
    });

    return grammar;
}

const generateNearleyRulesFromTextSpecs = (name: string, components: NodeTextSpec[], context: GrammarCreationContext, parentRule?: string) : string => {    
    if (context.rulesByName[name]) {
        return name;
    }
    context.rulesByName[name] = 'inProgress';
    
    const rules = [];
    for (let i = 0; i < components.length; i++) {
        rules.push(`${asNewRule(getRuleDefinitionForTextSpec(components[i], context, parentRule), context, true, parentRule)}`);
    }
    const rule = rules.join(' ');

    context.namesByRule[rule] = name;
    context.rulesByName[name] = rule;
    return name;
}

export const parseSpec = (spec: NodeTextSpec, input: string) : Result<any> => {

    let grammar = "";
    if (typeof(spec) === 'string') {
        // the rule generated otherwise would just be a string rather than a rule name,
        // just return a simple match rule
        grammar += `rule -> "${sanitizeString(spec)}"`;
    }
    else {
        const creationContext = getNewContext();    
        const rule = newGetRuleDefinitionForTextSpec(spec, creationContext, 0);
        
        grammar += "@{% ";
        
        (window as any)._livelangNearley = creationContext.functions;
        _.keys(creationContext.functions).forEach(key => {
            grammar += `function ${key}(data) {return window._livelangNearley.${key}(data)} `
        });
        grammar += "%}\n\n";

        // Make sure our first rule comes first
        grammar += `${rule} -> ${creationContext.rulesByName[rule]}\n\n`;
        delete creationContext.rulesByName[rule];

        grammar += generateChildRules(creationContext);
    }

    const compiled = nearley.compileGrammar(grammar);
    return nearley.parse(compiled.result, input);
}

export const generateNearleyGrammarFromSpec = (spec: NodeTextSpec) : string => {

    const creationContext = getNewContext();    
    const rule = newGetRuleDefinitionForTextSpec(spec, creationContext, null);
    
    let grammar = "";
    grammar += generateFunctions(creationContext);
    grammar += generateChildRules(creationContext);

    return grammar;
}

export const callFunction = (func: any, args: Array<any>, context: GrammarCreationContext) => {
    const keys = _.keys(context.functions);
    let funcName = 'func' + (keys.length + 1);

    for (let i = 0; i < keys.length; i++) {
        if (context.functions[keys[i]] === func) {
            funcName = keys[i];
            break;
        } 
    }

    context.functions[funcName] = func;
    return `{% function(data) {return ${funcName}(${args.join(', ')});} %}`;
};

export const sanitizeString = str => str.replace(/"/g, '\\"'); 

export const newGetRuleDefinitionForTextSpec = (spec: NodeTextSpec, context: GrammarCreationContext, depthFromNode: number, parentRule?: NodeTextSpec) : string => {
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
        const or = asAny.or as NodeTextSpec[];
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
        const all = asAny.all as NodeTextSpec[];
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
    else if ((spec as NodeTextDescription<any>).id) {

        const description = spec as NodeTextDescription<any>;
        if (context.rulesByName[description.id]) {
            return description.id;
        }
        
        // Incase we call ourselves recursively, only text descriptions can
        // do that as they're object references
        context.rulesByName[description.id] = 'inProgress';

        // Assume it's a node text description object
        const rule = description.getTextSpecs().map(spec => 
            newGetRuleDefinitionForTextSpec(spec, context, 0, description)
        ).join(' ') + ' ' + callFunction(description.updateNodeFromComponents, ['data'], context);

        context.rulesByName[description.id] = rule;
        return asNewRule(rule, context, false);
    }
    
};

const getRuleDefinitionForTextSpec = (component: NodeTextSpec, context: GrammarCreationContext, parentRule?: string) : string => {

    const asAny = component as any;

    const getActualRule = (component: NodeTextSpec, context: GrammarCreationContext, parentRule?: string) => {
        if (typeof(component) === 'string') {
            // String literal
            return `"${(component as string).replace(/"/g, '\\"')}"`;
        }
        else if (component instanceof RegExp) {
            console.error('RegExp not supported for nearley grammar');
        }
        else if (asAny.charset) {
            return asNewRule(`[${asAny.charset}] {% ${flatten.toString()} %}`, context, true, parentRule);
        }
        else if ((component as NodeTextDescription<any>).id) {
            // Assume it's a node text description object
            const description = component as NodeTextDescription<any>;
            if (!context.rulesByName[description.id]) {
                generateNearleyRulesFromTextSpecs(description.id, description.getTextSpecs(), context, parentRule);
            }

            return description.id;
        }
        else if (asAny.all) {
            // All components in a row
            const all = asAny.all as NodeTextSpec[];
            return '(' + all.map(component => getRuleDefinitionForTextSpec(component, context, parentRule)).join(' ') + ')';
        }
        else if (asAny.or) {
            // One of a choice of components
            const or = asAny.or as NodeTextSpec[];
            return '(' + or.map(component => getRuleDefinitionForTextSpec(component, context, parentRule)).join(' | ') + ')';
        }
        else if (asAny['?'] || asAny['*'] || asAny['+']) {
            if (_.keys(asAny).length !== 1) {
                console.error('Wat r u doin');
            }

            const quantifier = _.keys(asAny)[0] as string,
                component = _.values(asAny)[0] as NodeTextSpec,
                childRule = generateNearleyRulesFromTextSpecs(getChildRuleName(context, parentRule), [component], context, parentRule);

            return childRule + ':' + quantifier;
        }
    }

    return getActualRule(component, context, parentRule);    
};