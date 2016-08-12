import * as AST from '../ast/index';

export type CodeToText<T extends AST.CodeNode> = (node: T) => string;
export type TextToCode<T extends AST.CodeNode> = (text: string) => T; 

export type NodeParseComponent = string 
    | RegExp
    | NodeParseDescriptor<any>
    | {all: NodeParseComponent[]} // all in a row
    | {maybe: NodeParseComponent} // one or none
    | {any: NodeParseComponent}  // any number of the same thing
    | {many: NodeParseComponent} // at least 1 of the same thing
    | {choice: NodeParseComponent[]}; // 1 of a number of things
export type ParsedComponent = ParsedComponentType | ParsedComponentType[];
export type ParsedComponentType = string | AST.CodeNode;
export type RenderedComponent = string | NodeParseDescriptor<any>;

export interface NodeParseDescriptor<T extends AST.CodeNode> {
    /**
     * Has to be a function to avoid block scoped ordering issues
     */
    getComponents: () => NodeParseComponent[]

    nodeFromComponents: (components: ParsedComponent[]) => T,
    componentsFromNode: (node: T) => RenderedComponent[]
}

export function tryParseDescriptor<T extends AST.CodeNode>(descriptor: NodeParseDescriptor<T>, stream: CharStream) : {result?: T} {
    const components = tryParseComponents(descriptor.getComponents(), stream).result;
    if (components && components.length > 0) {
        return {result: descriptor.nodeFromComponents(components)};
    }
    return {result: null};
}

export function tryParseComponents(components: NodeParseComponent[], stream: CharStream, descriptorChain: NodeParseDescriptor<any>[] = []) : {result?: ParsedComponent[]} {

    // I know I know, types... shit's hard with compilers tho'
    if (!Array.isArray(components)) {
        components = [components] as any;
    }
    let allParsed: ParsedComponent[] = [];

    for (let i = 0; i < components.length; i++) {

        const thisComponent = components[i] as any;
        let parsed: ParsedComponent;

        if (typeof(thisComponent) === 'string') { // Plain string
            const confidence = parseLiteralConfidence(stream, thisComponent as string);
            if (confidence < 0.75) {
                return false;
            }
            parsed = thisComponent as string;
        }
        else if (thisComponent instanceof RegExp) { // Regexp
            parsed = parseRegex(stream, (thisComponent as RegExp)).result;
            if (!parsed) {
                return false;
            }            
        }
        else if ((thisComponent as any).getComponents) { // Parse Descriptor

            const descriptor: NodeParseDescriptor<any> = thisComponent as NodeParseDescriptor<any>;
            if (!descriptorChain.every(e => e !== descriptor)) {
                return false;
            }
            const components = descriptor.getComponents();
            parsed = tryParseComponents(components, stream, descriptorChain.slice().concat([descriptor])).result as any;
            if (!parsed) {
                return false;
            }
        }
        else if (thisComponent.maybe) { // Maybe
            parsed = tryParseComponents([thisComponent.maybe], stream).result as any;
            // we don't return here'
        }
        else if (thisComponent.all) { // All 
            parsed = tryParseComponents(thisComponent.all, stream).result as any;
        }
        else if (thisComponent.any) { // Any
            let array: any[] = [];
            let lastResult: any = null;
            do {
                lastResult = tryParseComponents([thisComponent.any], stream);
                if (lastResult) {
                    array.push(lastResult);
                }
            } while (lastResult != null);
            parsed = array;
        }
        else if (thisComponent.many) { // Many
            let array: any[] = [];
            let lastResult: any = null;
            do {
                lastResult = tryParseComponents([thisComponent.any], stream);
                if (lastResult) {
                    array.push(lastResult);
                }
            } while (lastResult != null);
            if (array.length === 0) {
                return false;
            }
            parsed = array;
        }
        else if (thisComponent.choice) { // Choice
            
            for (let choice = 0; choice < thisComponent.choice.length; choice++) {
                const thisChoice = thisComponent.choice[choice];
                const result = tryParseComponents(thisChoice, stream).result;
                if (result) {
                    parsed = result as any;
                    break;
                }
            }
            if (!parsed) {
                return false;
            }
        }

        allParsed.push(parsed);
    }

    return allParsed;
}

export const charStreamFromString = (str: string) : CharStream => {
    return {
        content: str, 
        position: 0,
        fromPosition() {
            return str.substr(this.position);
        }
    }
};

interface CharStream {
    content: string,
    position: number,
    fromPosition() : string
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

function parseRegex(stream: CharStream, regex: RegExp) : {result?: string} {
    const result = nextToken(stream);
    return {result: regex.test(result) ? result : null}
}

function parseLiteralConfidence(stream: CharStream, literal: string) : number {
    return nextToken(stream) === literal ? 1 : 0;
}

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

