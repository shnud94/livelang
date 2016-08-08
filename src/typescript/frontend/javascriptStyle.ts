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
            binaryExpression,
            prefixExpression,
            {
                nodeFromComponents: components => components[0] as string,
                componentsFromNode: (node: AST.IdentifierExpressionNode) => [node.identifier],
                getComponents: () => [identifier]  
            }
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

// Keep a tree of parsers for various nodes
// Then when rendering we can link each insertion point to a node in that tree so the program knows what is allowed there and what to try and parse

const parseTreeByNode: { [key: string]: (stream: CharStream) => ParseResult<any> }  = {

    [AST.CodeNodeTypes.module]: stream => {

        // TODO:
        return null as any;
    },
    [AST.CodeNodeTypes.func]: stream => {
        let confidence = 0;

        const maybeFunctionKeyword = parseIdentifier(stream);
        confidence += fuzzyMatch(maybeFunctionKeyword.result || '', 'function');
        if (confidence === 0) {
            return {
                confidence: 0,
                complete: false
            }
        }

        let functionNode: AST.FunctionNode = {
            typeIdentifier: types.BuiltInTypes.uint16,
            type: AST.CodeNodeTypes.func,
            identifier: '',
            children: [],
            parent: null
        };

        const identifier = parseIdentifier(stream);
        if (identifier.complete) {
            functionNode.identifier = identifier.result;
        }
        confidence += identifier.confidence;
        
        confidence += parseLiteral(stream, '(') ? 1 : 0;
        confidence += parseLiteral(stream, ')') ? 1 : 0;
        confidence += parseLiteral(stream, '{') ? 1 : 0;

        // TODO: parse function body

        confidence += parseLiteral(stream, '}') ? 1 : 0;    

        return {
            result: functionNode,
            complete: false,
            confidence: confidence 
        };
    },
    [AST.CodeNodeTypes.typeDeclaration]: stream => {
        return null as any;
    },
    [AST.CodeNodeTypes.variableDeclaration] : stream => {
        return null as any;
    }
}


export const controllerProvider = (node: AST.CodeNode) => controllersByNode[node.type](node);
export const controllersByNode: { [key: string]: (node: AST.CodeNode) => ComponentController } = {

    /*
        Process is as follows:

            1. Initial render
            2. User types change
            3. Controller receives change, returns response
            4. Calls appropriate event if necessary
            5. Appropriate event fires on renderer, re-renders if necessary
            6. Back to 1
    */    
    [AST.CodeNodeTypes.module]: (node: AST.ModuleNode) => {

        const events = View.createBaseComponentControllerEvents();

        return {
            events: events,
            handleNewInput(value, prev) {

                if (prev.id !== '}') {
                    return {
                        errors: ['fuck off'],
                        success: false,
                        completions: []
                    }
                }

                const parseResult = parseInModule(charStreamFromString(value));
                return {
                    errors: [],
                    success: false,
                    completions: [{completionText: parseResult.result.type, onComplete: () => {}}] // TODO:
                }
            },
            handleComponentChange(value, component) {

                if (component.text !== value) {
                    return {
                        errors: ['fuck you'],
                        success: false,
                        completions: []
                    }                    
                }
                if (component.id === 'module' && value !== 'module') {
                    return {
                        errors: ['fuck you'],
                        success: false,
                        completions: []
                    }                    
                }

                return {
                    errors: [],
                    success: false,
                    completions: []
                }
            },
            components() {
                return [
                    { text: 'module' },
                    { text: node.identifier },
                    { text: '{' },
                    { children: node.children.map(controllerForNode) },
                    { text: '}' }
                ];
            }
        }
    }
}
const controllerForNode = (node: AST.CodeNode) => controllersByNode[node.type](node);
const charStreamFromString = (str: string) => ({content: str, position: 0});

interface CharStream {
    content: string,
    position: number
}

const regExpEscaped = new Set(['{', '}', '(', ')']);
const defaultTokens = ['{', '}', '(', ')'];

/// Push forward the char stream position and get the next token separated by whitespace
function nextToken(stream: CharStream, tokens = defaultTokens) : string {
    const remainder = stream.content.substr(stream.position);
    if (remainder.length === 0) {
        return '';
    }

    const escapedTokens = tokens.map(t => {
        if (regExpEscaped.has(t)) {
            return '\\' + t;
        }
        return t;
    }).join('');

    const result = new RegExp(`^\\s*([${escapedTokens}]|[^\\s${escapedTokens}]*)\\s*`).exec(remainder);
    stream.position += result[0].length;
    return result[1];
}

interface ParseResult<T> {
    result?: T
    
    // Whether or not the node has been completely parsed. Can still parse a node,
    // but node could be incomplete, missing parts
    complete: boolean,
    
    // Only really used if complete node is not provided, otherwise can assume
    // that we have 100% confidence, because we were able to parse the whole thing
    confidence: number 
}

type Parser<T> = (stream: CharStream) => ParseResult<T>;

/**
 * May return null
 */
function parseBest(stream: CharStream, parsers: Parser<AST.CodeNode>[]) : ParseResult<AST.CodeNode> {
    let results: ParseResult<AST.CodeNode>[] = [];
    for (let i = 0; i < parsers.length; i++) {

        const parseResult = parsers[i](stream);
        if (parseResult.complete && parseResult.result) {
            return parseResult;
        }
        results.push(parseResult);
    }

    return results.reduce((prev, curr) => {
        if (prev === null || curr.confidence > prev.confidence) {
            return curr;
        }
        else {
            return prev;
        }
    }, null);
}

export function parseInModule(stream: CharStream) : ParseResult<AST.CodeNode> {
    return parseBest(stream, [/*parseFunction, */parseModule]);
}

function parseModule(stream: CharStream) : ParseResult<AST.ModuleNode> {
    // TODO:
    return {
        complete: false,
        confidence: 0
    }
}

function parseLiteralConfidence(stream: CharStream, literal: string) : number {
    return nextToken(stream) === literal ? 1 : 0;
}

// TODO: Potentially return fraction for matches that aren't exact, e.g. 'fnction' for 'function' === 0.9
function parseLiteral(stream: CharStream, literal: string) : boolean {
    return nextToken(stream) === literal;
}

function fuzzyMatch(test: string, match: string) : number {
    const result = FuzzySet([match]).get(test);
    if (result === null || result.length === 0) {
        return 0;
    }
    else {
        return result[0][0];
    }
}

function parseIdentifier(stream: CharStream) : ParseResult<string> {

    const token = nextToken(stream);
    const result = /^[a-zA-Z_]+\w*/.test(token);

    if (result) {
        return {
            complete: true,
            confidence: 1,
            result: token
        };
    }
    else {
        return {
            complete: false,
            confidence: 0,
            result: null
        }
    }    
}

