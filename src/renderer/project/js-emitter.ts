import * as project from './project'
import * as _ from 'underscore'
import * as style from '../frontend/javascriptStyle'
import * as parser from '../parser/custom';
import * as AST from '../AST/index';
import * as checker from '../types/checker';
import * as types from '../types/index';
import * as HTTP from 'http';
import * as sockjs from 'sockjs';
import * as fs from 'fs';
const fsExtra = require('fs-extra');
import * as path from 'path';
import * as child_process from 'child_process'
import * as util from '../util'

type FunctionInvocationRecorder = (node: AST.CallExpressionNode) => FunctionInvocationRecorder

interface JSEmitOptions {
    /**
     * Pass something in that will track invoked function in the emitted code and do something with it,
     * various recording functions should be prebuilt
     */
    recordFunctionInvocations?: (node: AST.CallExpressionNode) => FunctionInvocationRecorder,
    endpoint?: string

    checker: checker.TypeChecker
}

export function getDefaultOptions() : JSEmitOptions {
    return {
        checker: () => types.getAnyType()
    }
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
        else if (child.type === 'returnStatement') {
            return child.expression ? `return ${emitExpression(child.expression)};` : 'return;'
        }
    }).join('\n');
}

export function emitCallExpression(expression: AST.CallExpressionNode, emitOptions: JSEmitOptions = getDefaultOptions()) : string {
    if (expression.target.type === 'expressionidentifier') {

        // Convert to binary operator if we can
        const binaryOps = new Set(['+', '-', '/', '*', '%', '||', '&&']);
        if (binaryOps.has(expression.target.value) && expression.input.value.length === 2) {
            const [lhs, rhs] = expression.input.value;
            return emitExpression(lhs) + ' ' + expression.target.value + ' ' + emitExpression(rhs);
        }

        // Import statements
        if (expression.target.value === 'import') {
            return `livelang.modules['${expression.target.value}']`;
        }
    }

    const stripBrackets = input => input.substr(1, input.length - 2);
    const args =  (expression.input ? stripBrackets(emitExpression(expression.input, emitOptions, true)) : '') // remove brackets from livelang array literal
    return emitExpression(expression.target) + '(' + args + ')'
}

let sockJs: string | null = null;
export function getSockJs() : string {
    if (!sockJs) {
        const saveAt = path.join(util.getLivelangFolder(), 'lib', 'sockjs.min.js');
        fsExtra.mkdirsSync(path.join(util.getLivelangFolder(), 'lib'));
        child_process.execSync(`curl -o ${saveAt} http://cdn.jsdelivr.net/sockjs/1/sockjs.min.js`);
        sockJs = fs.readFileSync(saveAt).toString();
    }
    return sockJs;
}

export function wrapEmittedExpression(expression: string, node: AST.ExpressionType, emitOptions: JSEmitOptions = getDefaultOptions()) : string {
    return `livelang.touch(${node._id}, ${expression})`;
}

export function emitLibrary(emitOptions: JSEmitOptions = getDefaultOptions()) : string {
    if (emitOptions.endpoint) {
        const sockJs = getSockJs();
        return sockJs + `
             (function() {
                 window.livelang = window.livelang || {};
                 livelang.sock = new SockJS('${emitOptions.endpoint}');
                 var open = false;
                 livelang.message = function(msg) {
                    if (!open) {
                        return setTimeout(livelang.message.bind(null, msg), 500);
                    }
                    sock.send(msg);
                 }
                 livelang.sendCallableStats = function(args) {
                    if (!open) {
                        return setTimeout(livelang.sendCallableStats.bind(null, args), 500);
                    }
                    sock.send(args);
                 }
                 livelang.touch = function(id, expr) {
                    livelang.message(JSON.stringify({_id: id, expression: expr}));
                    return expr;
                 }
                 var sock = livelang.sock;
                 sock.onopen = function() {
                     open = true;
                 };
                 sock.onmessage = function(e) {
                     console.log('message', e.data);
                 };
                 sock.onclose = function() {
                     console.log('close');
                 };
             }())
        `;
    }
    return '';
}

export function emitCallable(callable: AST.CallableLiteral, emitOptions: JSEmitOptions = getDefaultOptions()) : string {
    const identifiers = callable.input.map(i => i.identifier);

    identifiers.map(identifier => `${identifier}:${identifier}`).join(',');
    const stats = `{_id: ${callable._id}, ${identifiers}}`;

    return `function(${identifiers.join(', ')}){\n` +
        `livelang.sendCallableStats(JSON.stringify(${stats}));\n` +
        emitChildren(callable.body) +
    '\n}'
}

export function emitExpression(expression: AST.ExpressionType, emitOptions: JSEmitOptions = getDefaultOptions(), noWrap: boolean = false) : string {

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
        result = '[' + expression.value.map(e => emitExpression(e, emitOptions)).join(', ') + ']'
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
        result = emitCallable(expression, emitOptions);
    }

    if (noWrap) return result;

    return wrapEmittedExpression(result, expression, emitOptions);
}

export function emitModule(module: AST.ModuleNode) {
    return emitChildren(module.children);
}

export function selfExecute(script) {
    return `(function(){${script}})()`
}

export function emitJs(modules: AST.ModuleNode[], emitOptions: JSEmitOptions = getDefaultOptions()) {
const main = modules.find(r => r.identifier.value === 'main');
    if (!main) {
        console.error('No main module');
    }

    return selfExecute(emitLibrary(emitOptions) + '\n' + modules.map(emitModule).join('\n'))
}