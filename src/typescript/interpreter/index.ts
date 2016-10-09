import * as AST from '../ast/index';
import * as Types from '../types/index';
import * as Checker from '../types/checker';
import * as reps from './runtime/reps';
import {RunTimeRepresentation} from './runtime/reps';
const log = require('debug')('livelang:interpreter');

interface Stack {
    declared: {[key: string] : reps.RunTimeRepresentation<any>},
    parent?: Stack
}

type RunTimeExpression = AST.ExpressionType & {_type: Types.Type}

interface RunContext {
    typeCheckContext: Checker.TypeCheckContext,
    stack: Stack,
    resultsPerNode: {[id: string] : {node: AST.Nodes, results: RunTimeRepresentation<any>[]}}
}

export function startChildStack(context: RunContext) : Stack {
    const current = context.stack;
    context.stack = {
        declared: {},
        parent: current
    };
    return context.stack;
}

export function endChildStack(context: RunContext) {
    context.stack = context.stack.parent;
}

export function evaluateExpression(expr: AST.ExpressionType, context: RunContext) : RunTimeRepresentation<any> {

    function getExpressionResult() {
        const {typeCheckContext, stack} = context;
        if (expr.type === 'expressionidentifier') {
            return fetchDeclared(expr.value, stack);
        }
        if (expr.type === 'expressioncallExpression') {
            return evaluateCallExpression(expr, context) as any;
        }
        else if (expr.type === 'expressionstringLiteral') {
            const rawVal = reps.stringRep();
            rawVal.set(expr.value);
            return rawVal;
        }
        else if (expr.type === 'expressionnumericLiteral') {
            const asNumber = expr.value;
            if (asNumber % 1 === 0) {
                const raw = reps.int32Rep();
                raw.set(asNumber);
                return raw;
            }
            else {
                const raw = reps.float64Rep();
                raw.set(asNumber);
                return raw;
            }
        }
        else if (expr.type === 'expressionarrayLiteral') {
            const raw = reps.arrayRep();
            raw.set(expr.value.map(val => evaluateExpression(expr, context)));
            return raw;
        }
        else if (expr.type === 'expressioncallableLiteral') {
            if (expr._runtime && expr._runtime.impl) {
                return reps.callableRep(expr._runtime.impl, expr.input.map(i => i.identifier));
            }

            return reps.callableRep(expr.body, expr.input.map(i => i.identifier));
        }
        else if (expr.type === 'expressionmemberAccess') {
            const subject = evaluateExpression(expr.subject, context);
            const member = evaluateExpression(expr.member, context);

            return subject.rawValue[member.rawValue];
        }
        else if (expr.type === 'expressionfunctionAccess') {

        }
        log('Unsupported expression type');
    }

    const result = getExpressionResult();
    if (expr._id) {
        context.resultsPerNode[expr._id] = (context.resultsPerNode[expr._id] || {node: expr, results:[]});
        context.resultsPerNode[expr._id].results.push(result);
    } 
    return result;    
}

export function fetchDeclared(identifier: string, stack: Stack) {
    return stack.declared[identifier] || (stack.parent ? fetchDeclared(identifier, stack.parent) : null);
}

export function evaluateCallExpression(expr: AST.CallExpressionNode, context: RunContext) : RunTimeRepresentation<any> | void {

    // If the call expression is calling a function, we can have multiple for the same identifier,
    // thus these are binded at type check type.
    const callable = evaluateExpression(expr._runtime.target || expr.target, context) as any;
    
    // Transfer our variables from the parent context into the child with new names
    startChildStack(context);

    let args = expr.input.value.map((input, index) => {
        const rawInput = evaluateExpression(input, context);
        if (callable.identifiers) {
            context.stack.declared[callable.identifiers[index]] = rawInput;
        }
        return rawInput;
    });
    
    let ret;
    if (typeof(callable.rawValue) === 'function') {
        ret = callable.rawValue.apply(null, [args]);        
    }
    else if (Array.isArray(callable.rawValue)) {
        ret = evaluateBody(callable.rawValue as AST.ModuleChild[], context);
    }
    else {
        log('Unsupported call expression');
    }

    endChildStack(context);
    if (ret) return ret;    
}

export function evaluateBody(node: AST.ModuleChild[], context: RunContext) : RunTimeRepresentation<any> | void {
    node.forEach(node => {
        if (node.type === 'declaration') {
            if (node.valueExpression) {
                context.stack.declared[node.identifier.value] = evaluateExpression(node.valueExpression, context);
            }
        }
        else {
            evaluateExpression(node as AST.ExpressionType, context);
        }
    });
}

export function evaluateModule(mod: AST.ModuleNode) : RunContext {

    const typeCheckContext = Checker.typeCheckModule(mod);

    typeCheckContext.errors.map(error => console.error(error));
    typeCheckContext.warnings.map(error => console.warn(error));

    if (typeCheckContext.errors.length > 0) {
        log('Type checker found errors, not running');        
        return {typeCheckContext, stack: null, resultsPerNode: null};
    }    

    const context: RunContext = {
        typeCheckContext: typeCheckContext,
        stack: {
             declared: {},
             parent: null 
        },
        resultsPerNode: {}
    };
    evaluateBody(mod.children, context);
    return context;
}
