import {EventSource} from '../util/events';

export type CodeNodeType = string;
export namespace CodeNodeTypes {
    export const module: CodeNodeType = "module";

    export const typeDeclaration: CodeNodeType = "typeDeclaration";
    export const declaration: CodeNodeType = "declaration";
    export const assignment: CodeNodeType = "assignment";

    export const identifier: CodeNodeType = "expressionidentifier";
    export const memberAccess: CodeNodeType = "expressionmemberAccess";
    export const callExpression: CodeNodeType = "expressioncallExpression";
    export const numericLiteral: CodeNodeType = "expressionnumericLiteral";
    export const stringLiteral: CodeNodeType = "expressionstringLiteral";
    export const arrayLiteral: CodeNodeType = "expressionarrayLiteral";
    export const mapLiteral: CodeNodeType = "expressionmapLiteral";
    export const callableLiteral: CodeNodeType = "expressioncallableLiteral";
}
export const Types = CodeNodeTypes;

interface CodeNodeRuntime {
    events: {
        nodeChanged: EventSource<void>,
        nodeInterpreted: EventSource<any>,
        nodeError: EventSource<string>
    }
}

export interface CodeNode {
    _id?: string
    _runtime?: CodeNodeRuntime

    // Display options for different language frontends, line breaks in javascript, all that stuff
    display?: {
        frontends?: {[frontend: string] : any},

        /**
         * Any whitespace before this node
         */
        whitespace?: string
    }
    
    type: CodeNodeType
    _parent: CodeNode,    
}

export interface AssignmentNode extends CodeNode {
    identifier: Identifier,
    valueExpression?: ExpressionType,
}

export interface DeclarationNode extends CodeNode {
    mutable: boolean
    identifier: Identifier,
    valueExpression?: ExpressionType,
    typeExpression?: ExpressionType
}

export interface ImportNode extends CodeNode {
    identifier: Identifier
}

export interface TypeDeclaration extends CodeNode {

    /**
     * Every type must have a unique identifier not equal to one already created, which includes those that are preexisting such as
     * string, boolean, array, int32 etc. 
     */
    identifier: Identifier,
    
    /**
     * Type expressions can consist of existing type identifiers and modifiers
     * 
     * Top level types
     * - Single field types, e.g: boolean, int32, string
     * - Callable types: function
     * - Array types i.e. [values]
     * - Map types i.e. keys:values
     * 
     * Custom modifiers can be created, however some built-in modifiers:
     * 
     * ### Map types
     * - Partial, any number of keys, but at least one
     * - Only one key, or one specific key
     * 
     * Because we have a JavaScript runtime environment, we can modify types as we write code and
     * get the result of each type at compile time using the javascript runtime. Then, use these types
     * to compile into something lower-level
     * 
     * We use expression node here because it could be possible to use things like binary expressions to modify
     * types such as unifying two types together with & etc.
     */
    typeExpression: ExpressionType 
}

export type ExpressionType = Identifier | ValueNode<any> | CallExpressionNode | MemberAccessExpression;
export type Identifier = ValueNode<string>;

export interface MemberAccessExpression extends CodeNode {
    member: Identifier
    subject: ExpressionType
}

export interface CallableLiteral extends CodeNode {
    input: ExpressionType,
    body: ModuleChild
    output: ExpressionType
}

export interface PrefixExpressionNode extends CodeNode {
    operator: string,
    subExpression: ExpressionType 
}

// This is what we use for any literal type, because we store the value 
// in its JS form and can gather the data and type from that
export interface ValueNode<T> extends CodeNode {
    value: T
}
export type ArrayLiteralNode = ValueNode<Array<ExpressionType>>;
export type NumericLiteralNode = ValueNode<number>;
export type StringLiteralNode = ValueNode<string>;
export type MapLiteralNode = ValueNode<{[key: string] : any}>;

export interface CallExpressionNode extends CodeNode {
    target: ExpressionType
    input?: ExpressionType
}

export type ModuleChild = DeclarationNode | ExpressionType | AssignmentNode | TypeDeclaration | ModuleNode;
export interface ModuleNode extends CodeNode {

    /**
     * Everything that comes under this module node inherits the version from its module. We use this to handle
     * changes in the language, and upgrade old code in a reliable way
     */
    version: string
    children: ModuleChild[]

    // IDEA: Short name and a fully qualified name for imports etc.
    identifier: Identifier

    // IDEA: Some stuff to setup this module for the evironment if it calls code from another language/runtime so that the module
    // can be treated as if normal
}

export function createProgram() : ModuleNode {
    return {
     children: []
    } as ModuleNode;
}

export function createArrayLiteral(values: ExpressionType[]) : ArrayLiteralNode {
    return {
        type: CodeNodeTypes.arrayLiteral,
        value: values,
        _parent: null    
    }
}

export function createIdentifier(identifier: string, parent?: CodeNode) : Identifier {
    return {
        type: CodeNodeTypes.identifier,
        value: identifier,
        _parent: parent    
    }
}