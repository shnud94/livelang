import { LiveLangProject } from '../../project/project';
import * as checker from '../../types/checker';
import * as AST from '../../ast/index';
import * as React from 'react';

export function nodeToString(node: AST.Nodes) {
    if (node.type === 'assignment') {
        return `${node.identifier.value} = ${nodeToString(node.valueExpression)}`
    }
    else if (node.type === 'expressionidentifier') {
        return node.value;
    }
    else if (node.type === 'expressionarrayLiteral') {
        return `[${node.value.map(node => nodeToString(node)).join(', ')}]`
    }
    else if (node.type === 'declaration') {
        return `let ${node.identifier.value} = ${nodeToString(node.valueExpression)}`
    }
    else if (node.type === 'expressionmemberAccess') {
        return `${nodeToString(node.subject)}.${nodeToString(node.member)}`;
    }
    else if (node.type === 'expressionstringLiteral') {
        return `"${node.value}"`
    }
    else if (node.type === 'expressionnumericLiteral') {
        return node.value.toString();
    }
    else if (node.type === 'returnStatement') {
        return `return ${nodeToString(node.expression)}`
    }
    else if (node.type === 'expressioncallExpression') {
        return `return ${nodeToString(node.target)}(${nodeToString(node.input)})`
    }
    else if (node.type === 'module') {
        return `module ${node.identifier.value}`
    }
}

export function nodeToLine(node: AST.Nodes) {
    
}

export function renderError(error: checker.TypeCheckError, project?: LiveLangProject) : JSX.Element | string {
    if (error.kind === 'typeErrorGeneric') {
        return <div className="typeError typeErrorGeneric">
            <div className="error">{error.value}</div>
            <div className="nodes">
                {error.nodes.map(node => nodeToString(node))}
            </div>
            <div className="lines">
                {error.nodes.map(node => nodeToLine(node))}
            </div>
        </div>
    }
    else if (error.kind === 'typeUndefined') {
        return renderError(checker.createError(`Couldn't find anything named ${error.source.value}`, [error.source]));
    }
    else {
        return 'Unknown error type';
    }
}