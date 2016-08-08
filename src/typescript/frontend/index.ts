import * as AST from '../ast/index';

export type CodeToText<T extends AST.CodeNode> = (node: T) => string;
export type TextToCode<T extends AST.CodeNode> = (text: string) => T; 

export type NodeParseComponent = string 
    | RegExp
    | NodeParseDescriptor<any>
    | {all: NodeParseComponent[]}
    | {maybe: NodeParseComponent}
    | {any: NodeParseComponent} 
    | {many: NodeParseComponent}
    | {choice: NodeParseComponent[]};
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