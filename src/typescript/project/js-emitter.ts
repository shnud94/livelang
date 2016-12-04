import * as project from './project'
import * as _ from 'underscore'
import * as style from '../frontend/javascriptStyle'
import * as parser from '../parser/custom';
import * as AST from '../AST/index';
import * as checker from '../types/checker';

type FunctionInvocationRecorder = (node: AST.CallExpressionNode) => FunctionInvocationRecorder

interface JSEmitOptions {
    /**
     * Pass something in that will track invoked function in the emitted code and do something with it,
     * various recording functions should be prebuilt
     */
    recordFunctionInvocations?: (node: AST.CallExpressionNode) => FunctionInvocationRecorder

}

export function emitChildren(children: AST.ModuleChild[]) : string {
    return children.map(child => {
        if (child.type === 'declaration') {
            const declaration = child as AST.DeclarationNode;
            return `let ${child.identifier.value} = ${emitExpression(child.valueExpression)};`
        }
        else if (child.type.startsWith('expression')) {
            return emitExpression(child as AST.ExpressionType) + ';'
        }
        else if (child.type === 'assignment') {
            return `${child.identifier.value} = ${emitExpression(child.valueExpression)};`
        }
    }).join('\n');
}

export function emitCallExpression(expression: AST.CallExpressionNode) : string {
    if (expression.target.type === 'expressionidentifier') {

        // Convert to binary operator if we can
        const binaryOps = new Set(['+', '-', '/', '*', '%', '||', '&&']);
        if (binaryOps.has(expression.target.value) && expression.input.value.length === 2) {
            const [lhs, rhs] = expression.input.value;
            return emitExpression(lhs) + ' ' + expression.target.value + ' ' + emitExpression(rhs);
        }

        // Import statements
        if (expression.target.value === 'import') {
            return `livelang.modules[${expression.target.value}]`;
        }
    }

    const args =  (expression.input ? emitExpression(expression.input).substr(-1).substr(1) : '') // remove brackets from livelang array literal
    return emitExpression(expression.target) + '(' + args + ')'
}

export function emitExpression(expression: AST.ExpressionType) : string {

    let result = '';

    if (expression.type === 'expressionidentifier') {
        result = expression.value;
    }
    else if (expression.type === 'expressioncallExpression') {
        result = emitCallExpression(expression);
    }
    else if (expression.type === 'expressionmemberAccess') {
        result = emitExpression(expression.subject) + `[${emitExpression(expression.member)}]`
    }
    else if (expression.type === 'expressionarrayLiteral') {
        result = '[' + expression.value.map(emitExpression).join(', ') + ']'
    }
    else if (expression.type === 'expressionnumericLiteral') {
        result = expression.value.toString()
    }
    else if (expression.type === 'expressionmapLiteral') {

        const entries = _.keys(expression.value).map(key => {
            return `"${key}":${emitExpression(expression.value[key])}`
        }).join(',\n')
        result = '{\n' + entries + '}';
    }
    else if (expression.type === 'expressionstringLiteral') {
        result = "`" + expression.value + "`";
    }
    else if (expression.type === 'expressioncallableLiteral') {

        const input = expression.input.map(i => i.identifier).join(', ')
        result = `function(${input}){\n` + emitChildren(expression.body) + '\n}'
    }

    return result;
}

export function emitModule(module: AST.ModuleNode) {
    return emitChildren(module.children);
}

export function emitJs(project: project.LiveLangProject, emitOptions?: JSEmitOptions) {

    if (!emitOptions) {
        emitOptions = {
            recordFunctionInvocations: null
        }
    }

    const modules = project.getAllModules();
    const parsed = modules.map(module => parser.parseSpecCached(style.theModule, module._savedContent, style.theModule.id));
    const results: AST.ModuleNode[] = parsed.map(p => {
        if (p.error) {
            console.error(p.error);
        }
        return p.result;
    });
    const modulesByIdentifier = _.indexBy(results, m => m.identifier)



    const main = results.find(r => r.identifier.value === 'main');
    if (!main) {
        console.error('No main module');
    }

    const livelangInit = JSON.stringify({
        modules: {}
    });

    return livelangInit + '\n' + results.map(mod => {
        return `livelang.modules[${mod.identifier}] = ${emitModule(mod)}`
    }).join('\n')
}