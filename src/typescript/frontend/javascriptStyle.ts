import * as program from '../program';
import {AST, Helpers, Program} from '../program';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as types from '../types/index';
import 'fuzzyset.js';
import * as index from './index';
import {ComponentController} from '../view/index';
import * as View from '../view/index';
import {NodeParseDescriptor} from './index';

// IDEA: Keep a tree of parsers for various nodes
// Then when rendering we can link each insertion point to a node in that tree so the program knows what is allowed there and what to try and parse


const frontendId = 'javascript';

export const frontendDescription = {
    descriptorForNode<T extends AST.CodeNode>(node: T) : NodeParseDescriptor<T> {
        return nodeTextualDescriptorForType(node.type) as NodeParseDescriptor<T>;
    }   
};

const identifier: RegExp = /^[a-zA-Z_]+\w*/;
const binaryOperator: RegExp = /^[-+*]|!=|==|>=|<=|<|>|\./;
const prefixOperator: RegExp = /^[-!]/;

function nodeTextualDescriptorForType(type: AST.CodeNodeType) : NodeParseDescriptor<any> {
    return descriptors[type] as any; 
}

const importStatement: NodeParseDescriptor<AST.ImportNode> = {
    nodeFromComponents: components => {
        return {
            type: AST.CodeNodeTypes.importt,
            parent: null,
            identifier: components[1] as string
        }
    },
    getComponents: () => ([
        'import',
        identifier
    ]),
    componentsFromNode: node => ['import', node.identifier]
}

const prefixExpression: NodeParseDescriptor<AST.PrefixExpressionNode> = {
    nodeFromComponents: components => {
        return {
            parent: null,
            type: AST.CodeNodeTypes.prefixExpression,
            operator: components[0] as string,
            subExpression: components[1] as AST.ExpressionNode
        }
    },
    getComponents: () => [
        prefixOperator,
        expression
    ],
    componentsFromNode: node => [node.operator, expression.componentsFromNode(node.subExpression).join(' ')]
}

const callExpression: NodeParseDescriptor<AST.CallExpressionNode> = {
    nodeFromComponents: components => {
        return {
            parent: null,
            type: AST.CodeNodeTypes.callExpression,
            subExpression: components[0] as AST.ExpressionNode,
            argument: components[2] as AST.ExpressionNode
        }
    },
    getComponents: () => ([
        expression,
        '(',
        {maybe: expression},
        ')'
    ]),
    componentsFromNode: node => [
        expression.componentsFromNode(node.subExpression).join(' '), 
        '(', 
        node.argument ? expression.componentsFromNode(node.argument).join(' ') : '',
        ')'
    ]
}

const binaryExpression: NodeParseDescriptor<AST.BinaryExpressionNode> = {

    nodeFromComponents: components => {
        return {
            type: AST.CodeNodeTypes.expressionBinary,
            parent: null,
            lhs: components[1] as AST.ExpressionNode,
            operator: components[2] as string,
            rhs: components[3] as AST.ExpressionNode,
            display: {
                [frontendId] : {
                    brackets: components[0] && components[4]
                }
            }
        }
    },
    getComponents: () => ([
        {maybe: '('},
        expression,
        binaryOperator,
        expression,
        {maybe: ')'},
    ]),
    componentsFromNode: node => [
        node.display[frontendId].brackets ? '(' : '',
        expression.componentsFromNode(node.lhs).join(' '), 
        node.operator,
        expression.componentsFromNode(node.rhs).join(' '), 
        node.display[frontendId].brackets ? ')' : ''
    ]
}

const expression: NodeParseDescriptor<AST.ExpressionNode> = {
    nodeFromComponents: components => (components[0] as AST.ExpressionNode),
    getComponents: () => [
        {choice: [
            {
                nodeFromComponents: components => components[0] as string,
                componentsFromNode: (node: AST.IdentifierExpressionNode) => [node.identifier],
                getComponents: () => [identifier]  
            },
            prefixExpression,
            binaryExpression,            
        ]}
    ],
    componentsFromNode: node => [
        nodeTextualDescriptorForType(node.type).componentsFromNode(node).join(' ')
    ]
};

const variableDeclaration: NodeParseDescriptor<AST.VariableDeclarationNode> = {
    nodeFromComponents: components => {
        return {
            type: AST.CodeNodeTypes.variableDeclaration,
            parent: null,
            mutable: components[1] != null,
            identifier: components[2] as string,
            valueExpression: components[3] ? ((components[3] as any)[1] as AST.ExpressionNode) : null,
            typeExpression: components[4] ? ((components[4] as any)[1] as AST.ExpressionNode) : null,
        }
    },
    getComponents: () => [
        'let',
        {maybe: 'mut'},
        identifier,
        {maybe: {
            all: [':', expression] // Type declaration
        }},
        {maybe: {
            all: ['=', expression] // Initial assignment
        }}
    ],
    componentsFromNode: node => [
        'let',
        node.mutable ? 'mut' : '',
        node.identifier,
        node.typeExpression ? `: ${nodeTextualDescriptorForType(node.typeExpression.type).componentsFromNode(node.typeExpression)}` : '',
        node.valueExpression ? `: ${nodeTextualDescriptorForType(node.typeExpression.type).componentsFromNode(node.valueExpression)}` : '',        
    ]
};

const theModule: NodeParseDescriptor<AST.ModuleNode> = {
    getComponents: () => [
        'module',
        identifier,
        '{',
        { any: { 
            choice: [expression, variableDeclaration] 
        }},
        '}'       
    ],
    nodeFromComponents: components => {
        return {
            type: AST.CodeNodeTypes.module,
            parent: null,
            identifier: components[1] as string,
            version: '0.0.1', // TODO: Store this in text somewhere?
            children: components[3] as AST.ModuleChild[],
            shortName: components[1] as string
        }    
    },
    componentsFromNode: node => [
        'module',
        node.identifier,
        '{',
        node.children.map(c => nodeTextualDescriptorForType(c.type).componentsFromNode(c).join(' ')).join(' '),
        '}'        
    ]
};

const descriptors: any = {
    [AST.CodeNodeTypes.importt] : importStatement,
    [AST.CodeNodeTypes.module] : theModule,
    [AST.CodeNodeTypes.callExpression] : callExpression,
    [AST.CodeNodeTypes.expressionBinary] : binaryExpression,
    [AST.CodeNodeTypes.variableDeclaration] : variableDeclaration,
    [AST.CodeNodeTypes.prefixExpression] : prefixExpression,
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
