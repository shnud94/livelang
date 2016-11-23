import * as AST from '../ast/index';

export type CodeToText<T extends AST.CodeNode> = (node: T) => string;
export type TextToCode<T extends AST.CodeNode> = (text: string) => T; 

/**
 * A specification for matching against text to create a parser grammar
 */
export type TextSpec = 
    
    // Should be parsed as single string or null
    string // Match a literal string
    | {charset: string}
    | {or: TextSpec[]} // Choice of options
    | {'?': TextSpec} // 0-1

    // Should be parsed as array, inner elements follow their own rules
    | {all: TextSpec[]} // All in sequence
    | {'*': TextSpec} // 0-inf
    | {'+': TextSpec} // 1-inf

    // Should be parsed as a value/node, as that's what we're describing
    | TextToValue<any>    
    | TextDescription<any>    

/**
 * A text component after being parsed or after being generated from a node
 */
export type TextComponent = TextComponentType | TextComponentType[];
type TextComponentType =
    string 
    /**
     * Look for a description for this node and use that. If you use this it
     * is assumed that the code node has an associated text descriptor defined. If not, an
     * error will be thrown at runtime
     */
    | AST.Nodes;

export interface Classes {
    kind: 'classes',
    classes: string[]
} 

export type CoolComponentExtra = ResultViewer | Classes;
export interface ResultViewer {
    kind: 'resultViewer',
    node: AST.DeclarationNode | AST.ExpressionType | AST.AssignmentNode,
    children?: CoolComponent
}

export type CoolComponent = CoolComponentType | CoolComponentType[];
export type CoolComponentType = TextComponent | {
    children: CoolComponent
    extras: CoolComponentExtra[]
}

export interface NodeTextDisplayOptions {
breaksLine?: boolean,

    // zero/null: no effect
    // 1: increase tab
    // -1: decrease tab
    tabsNextLine?: number 
}


export interface TextToValue<T> {
    /**
     * Used for the rule in the grammar
     */
    id: string,

    /**
     * Gets the textual description of a node as a list of specifications
     * @see NodeTextSpec
     * 
     * Note: This has to be a function to avoid block scoped ordering issues
     */
    getTextSpecs: () => TextSpec[]
    valueFromComponents(components: TextComponent[]) : T
}


export interface TextDescription<T> {
    /**
     * Used for the rule in the grammar
     */
    id: string,
    
    /**
     * Gets the textual description of a node as a list of specifications
     * @see NodeTextSpec
     * 
     * Note: This has to be a function to avoid block scoped ordering issues
     */
    getTextSpecs: () => TextSpec[]

    componentsFromValue: (node: T) => TextComponent[],
    coolComponentsFromValue?: (node: T) => CoolComponent
    updateValueFromComponents(components: TextComponent[], prev?: T) : T

    /**
     * Some text descriptions are associative, for example binary expression and its children in text
     * form can be interpreted differently depending on the operator. If we reparse just one binary expression's
     * components, its operator could change to one with higher associativity but remain in its current position
     * in the AST. Not good! When this flag is true, this will not be allowed and control will be pushed up
     * to a parent text description capable of interpreting the associativity
     */
    denyReparse?: boolean
}

/**
 * Something that describes the textual representation of a node, both how it gets created
 * from text, and how it gets transformed back to text once it's in its node form
 */
export interface NodeTextDescription<T extends AST.CodeNode> extends TextDescription<T> {    
    displayOptions?: () => NodeTextDisplayOptions[]
}