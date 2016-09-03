import {EventSource} from '../util/events';
import {Type} from '../types/index';

export type CodeNodeType = string;

interface CodeNodeRuntime {
    events: {
        nodeChanged: EventSource<void>,
        nodeInterpreted: EventSource<any>,
        nodeError: EventSource<string>
    },

    /**
     * This should definitely exist by runtime because we have to do type checking to get to runtime, which should populate this field
     */
    type: Type
}


export type Nodes = AssignmentNode | DeclarationNode | ModuleNode | TypeDeclaration | Identifier | CallExpressionNode | MemberAccessExpression | ExpressionType | MapLiteralNode;


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
    

    _parent: Nodes,    
}

export interface AssignmentNode extends CodeNode {
    type: 'assignment',
    identifier: Identifier,
    valueExpression?: ExpressionType,
}

export interface DeclarationNode extends CodeNode {
    type: 'declaration',
    mutable: boolean
    identifier: Identifier,
    valueExpression?: ExpressionType,
    typeExpression?: ExpressionType
}

export interface ImportNode extends CodeNode {
    identifier: Identifier
}

export interface TypeDeclaration extends CodeNode {
    type: 'typeDeclaration',

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

export type ExpressionType = Identifier | CallExpressionNode | MemberAccessExpression | FunctionAccessExpression | ArrayLiteralNode | NumericLiteralNode | MapLiteralNode | StringLiteralNode | CallableLiteral;
export interface Identifier extends CodeNode {
    type: 'expressionidentifier'
    value: string
}

/**
 * Access a member of a map type or array
 */
export interface MemberAccessExpression extends CodeNode {
    type: 'expressionmemberAccess',
    member: ExpressionType
    subject: ExpressionType
}

/**
 * Call a function that is available for this type
 */
export interface FunctionAccessExpression extends CodeNode {
    type: 'expressionfunctionAccess',
    identifier: Identifier
    subject: ExpressionType
}

export interface CallableLiteral extends CodeNode {
    type: 'expressioncallableLiteral'

    input: {type: ExpressionType, identifier: string}[],
    body: ModuleChild[]

    output: ExpressionType
    _runtime?: CodeNodeRuntime & {
        impl: Function
    }
}

export interface PrefixExpressionNode extends CodeNode {
    operator: string,
    subExpression: ExpressionType 
}

export interface ArrayLiteralNode extends CodeNode {
    type: 'expressionarrayLiteral'
    value: Array<any>
}
export interface NumericLiteralNode extends CodeNode {
    type: 'expressionnumericLiteral'
    value: number
}
export interface StringLiteralNode extends CodeNode {
    type: 'expressionstringLiteral'
    value: string
}
export interface MapLiteralNode extends CodeNode {
    type: 'expressionmapLiteral'
    value: {[key: string] : any}
}

export interface CallExpressionNode extends CodeNode {
    type: 'expressioncallExpression'
    target: ExpressionType
    input?: ArrayLiteralNode
}

export type ModuleChild = DeclarationNode | ExpressionType | AssignmentNode | TypeDeclaration | ModuleNode;
export interface ModuleNode extends CodeNode {
    type: 'module',

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


export function createArrayLiteral(values: ExpressionType[], parent?: Nodes) : ArrayLiteralNode {
    let arrayLiteral: ArrayLiteralNode = {
        type: 'expressionarrayLiteral',
        value: values,
        _parent: parent    
    }
    arrayLiteral.value.forEach(v => v._parent = arrayLiteral);
    return arrayLiteral;
}

export function createIdentifier(identifier: string, parent?: Nodes) : Identifier {
    return {
        type: 'expressionidentifier',
        value: identifier,
        _parent: parent
    }
}