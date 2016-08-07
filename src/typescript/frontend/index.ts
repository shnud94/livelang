import * as AST from '../ast/index';

export type CodeToText<T extends AST.CodeNode> = (node: T) => string;
export type TextToCode<T extends AST.CodeNode> = (text: string) => T; 