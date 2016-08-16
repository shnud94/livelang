import {NodeTextDescription, NodeTextSpec} from '../frontend/index';
import * as _ from 'underscore';

interface GrammarCreationContext {
    rulesByName: {[key: string] : any},
    childRulesByName: {[key: string] : any},
    charsetsSoFar: {[charset: string] : string}
}

export const getChildRuleName = (context: GrammarCreationContext, parentRule?: string) => {
    const parentName = parentRule ? parentRule : 'noParent';
    context.childRulesByName[parentName] = (context.childRulesByName[parentName] || 0) + 1;
    return parentName + context.childRulesByName[parentName];
}

export const generateNearleyGrammarFromTextSpec = (name: string, spec: NodeTextSpec) : string => {

    let creationContext: GrammarCreationContext = {
        rulesByName: {},
        childRulesByName: {},
        charsetsSoFar: {}
    }

    generateNearleyRulesFromTextSpecs(name, [spec], creationContext, name);
    let grammar = "";
    // By this point, rules by name should have all rules in it
    _.values(creationContext.rulesByName as any).forEach(value => {
        grammar += `${value}\n\n`;
    })

    return grammar;
}

export const generateNearleyGrammar = (description: NodeTextDescription<any>) : string => {
    
    let creationContext: GrammarCreationContext = {
        rulesByName: {},
        charsetsSoFar: {},
        childRulesByName: {}
    }

    generateNearleyRulesFromTextSpecs(description.id, description.getTextSpecs(), creationContext, description.id);

    let grammar = "";
    // By this point, rules by name should have all rules in it
    _.values(creationContext.rulesByName as any).forEach(value => {
        grammar += `${value}\n\n`;
    })

    return grammar;
}

const generateNearleyRulesFromTextSpecs = (name: string, components: NodeTextSpec[], context: GrammarCreationContext, parentRule?: string) : string => {    
    if (context.rulesByName[name]) {
        return name;
    }
    context.rulesByName[name] = 'inProgress';
    
    let rule = `${name} ->`;
    
    for (let i = 0; i < components.length; i++) {
        rule += ` ${getRuleDefinitionForTextSpec(components[i], context, parentRule)}`;
    }
    context.rulesByName[name] = rule;
    return name;
}

const getRuleDefinitionForTextSpec = (component: NodeTextSpec, context: GrammarCreationContext, parentRule?: string) : string => {

    const asAny = component as any;

    if (typeof(component) === 'string') {
            // String literal
            return `"${component as string}"`;
        }
        else if (component instanceof RegExp) {
            console.error('RegExp not supported for nearley grammar');
        }
        else if (asAny.charset) {

            return `[${asAny.charset}]`;

            // Attempt to stop multiple rules being created for identicalcharsets
            // if (context.charsetsSoFar[asAny.charset]) {
            //     return context.charsetsSoFar[asAny.charset];
            // }

            // const newRuleName = 'charset' + _.values(context.charsetsSoFar).length + 1;
            // context.charsetsSoFar[asAny.charset] = newRuleName;
            // context.rulesByName[newRuleName] = `newRuleName -> [${asAny.charset}]`;

            // return newRuleName;
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
};