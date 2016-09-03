import * as AST from '../ast/index';
import * as Types from '../types/index';
import * as reps from './runtime/reps';
import {RunTimeRepresentation} from './runtime/reps';
const log = require('debug')('livelang:interpreter');

interface Stack {
    declared: {[key: string] : reps.RunTimeRepresentation<any>},
    parent?: Stack
}

type RunTimeExpression = AST.ExpressionType & {_type: Types.Type}

interface RunContext {
    typeCheckContext: Types.TypeCheckContext,
    stack: Stack
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

    const {typeCheckContext, stack} = context;
    if (expr.type === 'expressionidentifier') {
        return stack.declared[expr.value];
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

export function evaluateCallExpression(expr: AST.CallExpressionNode, context: RunContext) : RunTimeRepresentation<any> | void {

    const callable = evaluateExpression(expr.target, context) as any;
    
    // Transfer our variables from the parent context into the child with new names
    startChildStack(context);
    if (callable.identifiers) {
        // TODO: Integrate this with grammar / type checker
        callable.identifiers.forEach((identifier: string, index: number) => {
            context.stack.declared[identifier] = evaluateExpression(expr.input.value[index], context);
        });
    }
    
    let ret;
    if (typeof(callable.rawValue) === 'function') {
        ret = callable.rawValue.apply(null, [expr.input.value, context]);        
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
            context.stack.declared[node.identifier.value] = evaluateExpression(node.valueExpression, context);
        }
        else {
            evaluateExpression(node as AST.ExpressionType, context);
        }
    });
}

export function evaluateModule(mod: AST.ModuleNode) {

    const typeCheck = Types.typeCheckModule(mod);

    typeCheck.errors.map(error => console.error(error));
    typeCheck.warnings.map(error => console.warn(error));

    if (typeCheck.errors.length > 0) {
        log('Type checker found errors, not running');        
        return;
    }    

    evaluateBody(mod.children, {
        typeCheckContext: typeCheck,
        stack: {
             declared: {},
             parent: null 
        }
    })
}
