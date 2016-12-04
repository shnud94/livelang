import {EventSource} from '../util/events';
import {Type} from '../types/index';
import * as Types from '../types/index';
import {RunTimeRepresentation} from '../interpreter/runtime/reps';

export type CodeNodeType = string;

interface CodeNodeRuntime {
    events?: {
        nodeChanged: EventSource<void>,
        nodeInterpreted: EventSource<any>,
        nodeError: EventSource<string>
    },

    /**
     * This should definitely exist by runtime because we have to do type checking to get to runtime, which should populate this field
     */
    type?: Type
}


export type Nodes = AssignmentNode | DeclarationNode | ModuleNode | Type | Identifier | CallExpressionNode | MemberAccessExpression | ExpressionType | MapLiteralNode | ReturnStatement;

export interface CodeNode {
    _id?: string
    _runtime?: CodeNodeRuntime
    _parent?: Nodes

    // Display options for different language frontends, line breaks in javascript, all that stuff
    display?: {
        frontends?: {[frontend: string] : any},

        /**
         * Any whitespace before this node
         */
        whitespace?: string
    },

    source?: {
        start: number,
        length: number,
        end: number
    }
}

export interface AssignmentNode extends CodeNode {
    type: 'assignment',
    identifier: Identifier,
    valueExpression?: ExpressionType,
}

export interface DeclarationNode extends CodeNode {
    type: 'declaration',
    flags: Set<'mutable' | 'function'>
    identifier: Identifier,
    valueExpression?: ExpressionType,
    typeExpression?: Type

}

export interface ImportNode extends CodeNode {
    identifier: Identifier
}

export type ExpressionType = Identifier | CallExpressionNode | MemberAccessExpression | FunctionAccessExpression | ArrayLiteralNode | NumericLiteralNode | MapLiteralNode | StringLiteralNode | CallableLiteral;
export interface Identifier extends CodeNode {
    type: 'expressionidentifier'
    value: string
}

export interface ReturnStatement extends CodeNode {
    type: 'returnStatement'
    expression?: ExpressionType
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

    input: {type: Type, identifier: string}[],
    body: ModuleChild[]

    output?: Type
    _runtime?: CodeNodeRuntime & {
        impl: (raw: RunTimeRepresentation<any>[]) => RunTimeRepresentation<any>
    }
}

export interface Scope extends CodeNode {
    type: 'scope',
    flags: Set<'init' | 'deinit'>,
    children: ModuleChild[]
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
    _runtime: CodeNodeRuntime & {
        target: CallableLiteral
    }
}

export type ModuleChild = DeclarationNode | ExpressionType | AssignmentNode | Type | Scope | ModuleNode | Type | ReturnStatement;
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

export function createModule(identifier: string, parent?: Nodes) : ModuleNode {
    return {
        type: 'module',
        children: [],
        identifier: createIdentifier(identifier),
        _parent: parent,
        version: '1.0'
    }
}

export function createStringLiteral(string: string, parent?: Nodes) : StringLiteralNode {
    let stringLiteralNode: StringLiteralNode = {
        type: 'expressionstringLiteral',
        value: string,
        _parent: parent    
    }
    return stringLiteralNode;
}

export function createNumericLiteral(value: number, parent?: Nodes) : NumericLiteralNode {
    let node: NumericLiteralNode = {
        type: 'expressionnumericLiteral',
        value: value,
        _parent: parent    
    }
    return node;
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

export function hasParent(a: Nodes, b: Nodes) {
    if (!a._parent && !b._parent) return null;

    if (!a._parent) return false;
    if (a._parent === b) return true;

    return hasParent(a._parent, b); 
}