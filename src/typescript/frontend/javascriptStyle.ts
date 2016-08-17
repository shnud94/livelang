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
        return flattened[0];
    }
    return something;
}
const assignParent = (node, parent) => {node.parent = parent; return node;}

export const frontendDescription = {
    descriptorForNode<T extends AST.CodeNode>(node: T) : NodeTextDescription<T> {
        return nodeTextualDescriptorForType(node.type) as NodeTextDescription<T>;
    }   
};

const __ = {'*': {charset: ' \\t\\n\\v\\f'}};
const ___ = {'+': {charset: ' \\t\\n\\v\\f'}};

function nodeTextualDescriptorForType(type: AST.CodeNodeType) : NodeTextDescription<any> {
    return descriptors[type] as any; 
}

export const prefixExpression: NodeTextDescription<AST.PrefixExpressionNode> = {
    id: AST.CodeNodeTypes.prefixExpression,
    updateNodeFromComponents: components => {
        return {
            parent: null,
            type: AST.CodeNodeTypes.prefixExpression,
            operator: components[0] as string,
            subExpression: components[1] as AST.ExpressionNode
        }
    },
    getTextSpecs: () => [
        {charset: "-!"},
        expression
    ],
    componentsFromNode: node => [node.operator, expression.componentsFromNode(node.subExpression).join(' ')]
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
        return [node.value.toString()]
    }
}

export const identifier: NodeTextDescription<AST.ValueNode> = {
    id: AST.CodeNodeTypes.identifier,
    updateNodeFromComponents: (components, prev) => {

        const value = flat(components);
        return {
            type: AST.CodeNodeTypes.identifier,
            value: value,
            parent: prev ? prev.parent : null
        }
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

export const postfixExpression: NodeTextDescription<AST.CallExpressionNode> = {
    id: AST.CodeNodeTypes.binaryExpression,
    updateNodeFromComponents: components => {
        return {
            parent: null,
            type: AST.CodeNodeTypes.callExpression,
            subExpression: components[0] as AST.ExpressionNode,
            argument: components[2] as AST.ExpressionNode
        }
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
        {or: ['=', '*', '/', '+', '-', '>', '<', '>=', '<=', '==', '!=', '&&', '||']},
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
    updateNodeFromComponents: components => _.flatten(components) as any, // TODO:
    getTextSpecs: () => [
        {or: [
            identifier,
            numericLiteral,
            stringLiteral,
            prefixExpression,
            binaryExpression,            
        ]}
    ],
    componentsFromNode: node => [
        node
    ]
};

export const declaration: NodeTextDescription<AST.DeclarationNode> = {
    id: AST.CodeNodeTypes.declaration,
    updateNodeFromComponents: (components, prev) => {
        let node = prev as any;
        if (!node) {
            node = {
                type: AST.CodeNodeTypes.declaration,
                parent: null, // TODO: How are we going to make sure parent isn't null when first creating a node?
            };
        }

        node.mutable = components[0] === 'var';
        node.identifier = components[2] as string;
        node.valueExpression = components[4];
        node.typeExpression = components[6];

        return node;
    },
    getTextSpecs: () => [
        {or: ['let', 'var']},
        ___,
        identifier,
        __,
        {'?': {all: [':', __, expression]}}, // Type declaration,
        __,
        {'?': {all: ['=', __, expression]}}, // Initial assignment
        __,
    ],
    displayOptions: () => [null, null, null, null, null, null, null, {breaksLine: true}],
    componentsFromNode: node => [
        node.mutable ? 'var' : 'let',
        ' ',
        node.identifier,
        '',
        node.typeExpression ? [': ', node.typeExpression] : null,
        ' ',
        node.valueExpression ? ['= ', node.valueExpression] : null,
        '',
    ]
};

export const theModule: NodeTextDescription<AST.ModuleNode> = {
    id: AST.CodeNodeTypes.module,
    getTextSpecs: () => [
        'module', // 0
        identifier, // 1
        '{', // 2
        {'*': {all: [ // 3
            {or: [expression, declaration]},  
            ';'
        ]}},
        '}' // 4
    ],
    displayOptions() {
        return [null, null, {breaksLine:true, tabsNextLine: 1}, {breaksLine: true, tabsNextLine: -1}, null]
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

        node.identifier = components[1] as string;
        node.children = components[3] as AST.ModuleChild[];
        return node;
    },
    componentsFromNode: node => [
        'module',
        node.identifier,
        '{',
        node.children,
        '}'        
    ]
};

export const descriptors: any = {
    [AST.CodeNodeTypes.module] : theModule,
    [AST.CodeNodeTypes.postfixExpression] : postfixExpression,
    [AST.CodeNodeTypes.prefixExpression] : prefixExpression,
    [AST.CodeNodeTypes.binaryExpression] : binaryExpression,
    [AST.CodeNodeTypes.declaration] : declaration
};


// const parseTreeByNode: { [key: string]: (stream: CharStream) => ParseResult<any> }  = {

//     [AST.CodeNodeTypes.module]: stream => {

//         // TODO:
//         return null as any;
//     },
//     [AST.CodeNodeTypes.func]: stream => {
//         let confidence = 0;

//         const maybeFunctionKeyword = parseIdentifier(stream);
//         confidence += fuzzyMatch(maybeFunctionKeyword.result || '', 'function');
//         if (confidence === 0) {
//             return {
//                 confidence: 0,
//                 complete: false
//             }
//         }

//         let functionNode: AST.FunctionNode = {
//             typeIdentifier: types.BuiltInTypes.uint16,
//             type: AST.CodeNodeTypes.func,
//             identifier: '',
//             children: [],
//             parent: null
//         };

//         const identifier = parseIdentifier(stream);
//         if (identifier.complete) {
//             functionNode.identifier = identifier.result;
//         }
//         confidence += identifier.confidence;
        
//         confidence += parseLiteral(stream, '(') ? 1 : 0;
//         confidence += parseLiteral(stream, ')') ? 1 : 0;
//         confidence += parseLiteral(stream, '{') ? 1 : 0;

//         // TODO: parse function body

//         confidence += parseLiteral(stream, '}') ? 1 : 0;    

//         return {
//             result: functionNode,
//             complete: false,
//             confidence: confidence 
//         };
//     },
//     [AST.CodeNodeTypes.typeDeclaration]: stream => {
//         return null as any;
//     },
//     [AST.CodeNodeTypes.variableDeclaration] : stream => {
//         return null as any;
//     }
// }


// export const controllerProvider = (node: AST.CodeNode) => controllersByNode[node.type](node);
// export const controllersByNode: { [key: string]: (node: AST.CodeNode) => ComponentController } = {

//     /*
//         Process is as follows:

//             1. Initial render
//             2. User types change
//             3. Controller receives change, returns response
//             4. Calls appropriate event if necessary
//             5. Appropriate event fires on renderer, re-renders if necessary
//             6. Back to 1
//     */    
//     [AST.CodeNodeTypes.module]: (node: AST.ModuleNode) => {

//         const events = View.createBaseComponentControllerEvents();

//         return {
//             events: events,
//             handleNewInput(value, prev) {

//                 if (prev.id !== '}') {
//                     return {
//                         errors: ['fuck off'],
//                         success: false,
//                         completions: []
//                     }
//                 }

//                 const parseResult = parseInModule(charStreamFromString(value));
//                 return {
//                     errors: [],
//                     success: false,
//                     completions: [{completionText: parseResult.result.type, onComplete: () => {}}] // TODO:
//                 }
//             },
//             handleComponentChange(value, component) {

//                 if (component.text !== value) {
//                     return {
//                         errors: ['fuck you'],
//                         success: false,
//                         completions: []
//                     }                    
//                 }
//                 if (component.id === 'module' && value !== 'module') {
//                     return {
//                         errors: ['fuck you'],
//                         success: false,
//                         completions: []
//                     }                    
//                 }

//                 return {
//                     errors: [],
//                     success: false,
//                     completions: []
//                 }
//             },
//             components() {
//                 return [
//                     { text: 'module' },
//                     { text: node.identifier },
//                     { text: '{' },
//                     { children: node.children.map(controllerForNode) },
//                     { text: '}' }
//                 ];
//             }
//         }
//     }
// }
// const controllerForNode = (node: AST.CodeNode) => controllersByNode[node.type](node);
