import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from '../program';
import {AST, Helpers, Program} from '../program';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as types from '../types/index';
import 'fuzzyset.js';
import * as index from './index';
import {ComponentController} from '../view/index';
import * as View from '../view/index';

type NodeTextualComponent = string | NodeTextualDescriptor | NodeTextualDescriptor[];

interface NodeTextualDescriptor {
    components: NodeTextualComponent[]
    nodeFromComponents: (components: NodeTextualComponent[]) => AST.CodeNode 
}

const theModule: NodeTextualDescriptor = {
    components: [
        'module',
    ],
    nodeFromComponents: components => null as any
};

const theProgram: NodeTextualDescriptor = {
    components: [theModule],
    nodeFromComponents: components => null as any
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

