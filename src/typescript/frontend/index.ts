import * as AST from '../ast/index';

export type CodeToText<T extends AST.CodeNode> = (node: T) => string;
export type TextToCode<T extends AST.CodeNode> = (text: string) => T; 

/**
 * A specification for matching against text to create a parser grammar
 */
export type NodeTextSpec = 
    
    // Should be parsed as single string or null
    string // Match a literal string
    | {charset: string}
    | {or: NodeTextSpec[]} // Choice of options
    | {'?': NodeTextSpec} // 0-1

    // Should be parsed as array, inner elements follow their own rules
    | {all: NodeTextSpec[]} // All in sequence
    | {'*': NodeTextSpec} // 0-inf
    | {'+': NodeTextSpec} // 1-inf

    // Should be parsed as a node, as that's what we're describing
    | NodeTextDescription<any>    

/**
 * A text component after being parsed or after being generated from a node
 */
export type NodeTextComponent = NodeTextComponentType | NodeTextComponentType[];
type NodeTextComponentType =
    string 
    /**
     * Look for a description for this node and use that. If you use this it
     * is assumed that the code node has an associated text descriptor defined. If not, an
     * error will be thrown at runtime
     */
    | AST.CodeNode;

export interface NodeTextDisplayOptions {
breaksLine?: boolean,

    // zero/null: no effect
    // 1: increase tab
    // -1: decrease tab
    tabsNextLine?: number 
}

/**
 * Something that describes the textual representation of a node, both how it gets created
 * from text, and how it gets transformed back to text once it's in its node form
 */
export interface NodeTextDescription<T extends AST.CodeNode> {

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
    getTextSpecs: () => NodeTextSpec[]
    
    componentsFromNode: (node: T) => NodeTextComponent[],
    updateNodeFromComponents(components: NodeTextComponent[], prev?: T) : T

    displayOptions?: () => NodeTextDisplayOptions[]
}