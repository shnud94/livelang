import * as program from '../program';
import {AST, Program} from '../program';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as types from '../types/index';
import 'fuzzyset.js';
import * as index from './index';
import {NodeTextController} from '../view/index';
import * as View from '../view/index';
import {NodeTextDescription, NodeTextSpec} from './index';

const frontendId = 'javascript';
const flat = (something: any) => {
    if (Array.isArray(something)) {
        const flattened = _.flatten(something);
        if (flattened.every(e => typeof(e) === 'string')) {
            return flattened.join('');
        }
        return flattened.length === 1 ? flattened[0] : flattened;
    }
    return something;
}
const flatten = (something: any) => {
    if (Array.isArray(something)) {
        const flattened = _.flatten(something);
        if (flattened.every(e => typeof(e) === 'string')) {
            return flattened.join('');
        }
        return flattened;
    }
    return something;
}
const assignParent = (node, parent) => {
    if (typeof(node) !== 'object') debugger;
    node.parent = parent; return node;
}

export const frontendDescription = {
    descriptorForNode<T extends AST.CodeNode>(node: T) : NodeTextDescription<T> {
        return nodeTextualDescriptorForType(node.type) as NodeTextDescription<T>;
    }   
};

const __ = {'*': {charset: ' \xA0\\t\\n\\v\\f'}};
const ___ = {'+': {charset: ' \xA0\\t\\n\\v\\f'}};

function nodeTextualDescriptorForType(type: AST.CodeNodeType) : NodeTextDescription<any> {
    return descriptors[type] as any; 
}

export const numericLiteral: NodeTextDescription<AST.ValueNode> = {
    id: AST.CodeNodeTypes.numericLiteral,
    updateNodeFromComponents: (components, prev) => {
        const value = parseFloat(flat(components));
        return {
            type: AST.CodeNodeTypes.numericLiteral,
            value: value,
            parent: prev ? prev.parent : null
        }
    },
    getTextSpecs() {
        return [
            {or: [
                {'+' : {charset: '0-9'}},    
                {all: [
                        {'*' : {charset: '0-9'}},
                        {all: ['.', {'+' : {charset: '0-9'}}]}
                    ]
                },    
            ]}
        ]
    },
    componentsFromNode: node => {
        return [node.value.toString()]
    }
}

export const stringLiteral: NodeTextDescription<AST.ValueNode> = {
    id: AST.CodeNodeTypes.stringLiteral,
    updateNodeFromComponents: (components, prev) => {
        const value = flat(components);
        return {
            type: AST.CodeNodeTypes.stringLiteral,
            value: value.substr(1, value.length - 2),
            parent: prev ? prev.parent : null
        }
    },
    getTextSpecs() {
        return [
            '"',
            {'*':{charset: '^"'}},
            '"'
        ]
    },
    componentsFromNode: node => {
        return ['"' + node.value.toString() + '"']
    }
}

export const identifier: NodeTextDescription<AST.ValueNode> = {
    id: AST.CodeNodeTypes.identifier,
    updateNodeFromComponents: (components, prev) => {
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.identifier,
                value: null,
                parent: prev ? prev.parent : null
            }
        }

        prev.value = flat(components);
        return prev;
    },
    getTextSpecs() {
        return [
            {all: [
                {charset: 'a-zA-Z'},
                {'*' : {charset: 'a-zA-Z0-9_-'}}
            ]}
        ]
    },
    componentsFromNode: node => {
        return [node.value.toString()]
    }
}

export const prefixExpression: NodeTextDescription<AST.PrefixExpressionNode> = {
    id: AST.CodeNodeTypes.prefixExpression,
    updateNodeFromComponents: (components, prev) => {

        if (!prev) {
            prev = {
                parent: null,
                operator: null,
                subExpression: null,
                type: AST.CodeNodeTypes.prefixExpression
            }
        }

        prev.operator = flat(components[0]) as string;
        prev.subExpression = assignParent(flat(components[1]) as AST.ExpressionNode, prev);

        return prev;
    },
    getTextSpecs: () => [
        {charset: "-!"},
        expression
    ],
    componentsFromNode: node => [
        node.operator, 
        node.subExpression
    ]
}

export const arrayLiteral: NodeTextDescription<AST.ValueNode> = {
    id: AST.CodeNodeTypes.arrayLiteral,
    updateNodeFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                parent: null,
                value: null,
                type: AST.CodeNodeTypes.arrayLiteral
            }
        }

        const elements = flatten(components[1]).filter(el => typeof(el) === 'object') as AST.ExpressionNode[]; 
        prev.value = elements.map(e => assignParent(e, prev));
        return prev;
    },
    getTextSpecs() {
        return [
            '[',
            {'?' : {all: [
                expression,
                {'*' : {all: [',', __, expression]}}
            ]}},            
            ']'
        ]
    },
    componentsFromNode: node => {
        return [
            '[',
            flatten(node.value.map((value, index, array) => {
               if (index > 0) {
                return [', ', value] as any
               } 
               else {
                   return [value] as any
               }
            })),
            ']'
        ]
    }
}

export const postfixExpression: NodeTextDescription<AST.CallExpressionNode> = {
    id: AST.CodeNodeTypes.binaryExpression,
    updateNodeFromComponents: (components, prev) => {
        
        // if (!prev) {
        //     prev = {
        //         parent: null,
        //         argument: null,
        //         subExpression: null,
        //         type: AST.CodeNodeTypes.postfixExpression
        //     }
        // }

        // prev.operator = flat(components[0]) as string;
        // prev.subExpression = assignParent(flat(components[1]) as AST.ExpressionNode, prev);

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        {or: [
            {all: ['(', {'?': expression}, ')']}, // call expression,
            {all: ['.', {or: [
                identifier,
                {all: ['[', expression, ']']}
            ]}]}
        ]}    
    ]),
    componentsFromNode: node => [
        expression.componentsFromNode(node.subExpression).join(' '), 
        '(', 
        node.argument ? expression.componentsFromNode(node.argument).join(' ') : '',
        ')'
    ]
}

export const binaryExpression: NodeTextDescription<AST.BinaryExpressionNode> = {
    id: AST.CodeNodeTypes.binaryExpression,
    updateNodeFromComponents: (components, prev) => {
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.binaryExpression,
                parent: null,
                lhs: null,
                operator: null,
                rhs: null
            }
        }

        prev.lhs = assignParent(flat(components[0]) as AST.ExpressionNode, prev);
        prev.rhs = assignParent(flat(components[4]) as AST.ExpressionNode, prev);
        prev.operator = flat(components[2]) as string;
        return prev;
    },
    getTextSpecs: () => ([
        expression,
        __,
        {or: ['*', '/', '+', '-', '>', '<', '>=', '<=', '==', '!=', '&&', '||']},
        __,
        expression
    ]),
    componentsFromNode: node => [
        node.lhs, 
        ' ',
        node.operator,
        ' ',
        node.rhs
    ]
}

export const expression: NodeTextDescription<AST.ExpressionNode> = {
    id: AST.CodeNodeTypes.expression,
    updateNodeFromComponents: components => {
        
        
        return flat(components);
    
    },
    getTextSpecs: () => [
        {or: [
            identifier,
            numericLiteral,
            stringLiteral,
            arrayLiteral,
            prefixExpression,
            binaryExpression,            
        ]}
    ],
    componentsFromNode: node => [
        node
    ]
};

export const assignment: NodeTextDescription<AST.AssignmentNode> = {
    id: AST.CodeNodeTypes.assignment,
    updateNodeFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.assignment,
                parent: null,
                identifier: null,
                valueExpression: null
            };
        }

        prev.identifier = assignParent(flat(components[0]) as AST.ValueNode, prev);
        prev.valueExpression = assignParent(flat(components[4]) as AST.ExpressionNode, prev);
        
        return prev;
    },
    getTextSpecs: () => [
        identifier,
        __,
        '=',
        __,
        expression
    ],
    componentsFromNode: node => [
        node.identifier,
        ' ',
        '=',
        ' ',
        node.valueExpression
    ]
};

export const declaration: NodeTextDescription<AST.DeclarationNode> = {
    id: AST.CodeNodeTypes.declaration,
    updateNodeFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.declaration,
                parent: null, // TODO: How are we going to make sure parent isn't null when first creating a node?
                mutable: null,
                identifier: null,
                valueExpression: null,
                typeExpression: null
            };
        }

        prev.mutable = (flat(components[0]) || '').trim() === 'var';
        prev.identifier = assignParent(flat(components[2]) as AST.ValueNode, prev);
        
        const maybeTypeExpression = (flat(components[4]) || []) [2] as AST.ExpressionNode;
        if (maybeTypeExpression) {
            prev.typeExpression = assignParent(maybeTypeExpression, prev);
        }

        const maybeValueExpression = (flat(components[6]) || []) [2] as AST.ExpressionNode;
        if (maybeValueExpression) {
            prev.valueExpression = assignParent(maybeValueExpression, prev);
        }
        
        return prev;
    },
    getTextSpecs: () => [
        {or: ['let', 'var']},
        ___,
        identifier,
        __,
        {'?': {all: [':', __, expression]}}, // Type expression,
        __,
        {'?': {all: ['=', __, expression]}}, // Initial assignment
    ],
    displayOptions: () => [null, null, null, null, null, null, null],
    componentsFromNode: node => [
        node.mutable ? 'var' : 'let',
        ' ',
        node.identifier,
        (node.typeExpression || node.valueExpression) ? ' ' : '',
        node.typeExpression ? [': ', node.typeExpression] : null,
        node.typeExpression ? ' ' : '',
        node.valueExpression ? ['= ', node.valueExpression] : null,
    ]
};

export const theModule: NodeTextDescription<AST.ModuleNode> = {
    id: AST.CodeNodeTypes.module,
    getTextSpecs: () => [
        'module', // 0
        ___,
        identifier, // 2
        ___,
        '{', // 4,
        __,
        {'*': {all: [ // 6
            {or: [assignment, expression, declaration]},
            __,  
            ';',
            __
        ]}},
        __,
        '}' // 8
    ],
    displayOptions() {
        return [null, null, null, null, null, null, null, {breaksLine: true, tabsNextLine: -1}, null]
    },
    updateNodeFromComponents: (components, prev) => {
        let node = prev;
        if (!node) {
            node = {
                type: AST.CodeNodeTypes.module,
                parent: null,
                identifier: null,
                version: '0.0.1', // TODO: Get the latest version that we're on right now
                children: null
            };
        }

        node.children = (flat(components[6]) as Array<any>).filter(child => typeof(child) !== 'string');
        node.identifier = flat(components[2]) as AST.ValueNode;
        return node;
    },
    componentsFromNode: node => [
        'module',
        ' ',
        node.identifier,
        ' ',
        '{',
        '\n',
        node.children.map(child => {
            return [child, ';\n']
        }) as any,
        ' ',
        '}'        
    ]
};

export const descriptors: any = {
    [AST.CodeNodeTypes.module] : theModule,
    [AST.CodeNodeTypes.postfixExpression] : postfixExpression,
    [AST.CodeNodeTypes.prefixExpression] : prefixExpression,
    [AST.CodeNodeTypes.identifier] : identifier,
    [AST.CodeNodeTypes.binaryExpression] : binaryExpression,
    [AST.CodeNodeTypes.declaration] : declaration,
    [AST.CodeNodeTypes.numericLiteral] : numericLiteral,
    [AST.CodeNodeTypes.stringLiteral] : stringLiteral,
    [AST.CodeNodeTypes.arrayLiteral] : arrayLiteral,
    [AST.CodeNodeTypes.assignment] : assignment,
};
