import {EventSource} from '../util/events';

export type CodeNodeType = string;
export namespace CodeNodeTypes {
    export const declaration: CodeNodeType = "declaration";
    export const callExpression: CodeNodeType = "callExpression";
    export const prefixExpression: CodeNodeType = "prefixExpression";
    export const postfixExpression: CodeNodeType = "postfixExpression";
    export const binaryExpression: CodeNodeType = "binaryExpression";
    export const expression: CodeNodeType = "expression";
    export const literalNode: CodeNodeType = "literal";
    export const module: CodeNodeType = "module";

    export const numericLiteral: CodeNodeType = "numericLiteral";
    export const stringLiteral: CodeNodeType = "stringLiteral";
    export const identifier: CodeNodeType = "identifier";
}
export const Types = CodeNodeTypes;

// export namespace Helpers {
    
//     export function hasType(node: CodeNode, type: CodeNodeType) {
//         return node.type.split('/').indexOf(type) >= 0;
//     } 

//     export function hasChildren(node: CodeNode) {
//         return Helpers.hasType(node, Types.scope);
//     }

//     export function maybeChildren(node: CodeNode) : CodeNode[] {
//         if (Helpers.hasType(node, Types.scope)) {
//             return (node as ScopeNode).children;
//         }
//         return [];
//     }

//     export function declaredIdentifiersAtNode(node: CodeNode, searchSource: CodeNode = node) : CodeNode[] {
//         if (!node.parent) {
//             return [];
//         }

//         let identifiersHere: CodeNode[] = [];
//         let children = this.maybeChildren(node);
        
//         // Only add children up to source if source is child,
//         // i.e. declared variables after the source are not available yet
//         for (let i = 0; i < children.length; i++) {
//             const child = children[i];
//             if (child._id === searchSource._id) {
//                 break;
//             }
//             identifiersHere = identifiersHere.concat(child);
//         }

//         return identifiersHere.concat(this.declaredIdentifiersAtNode(node.parent));
//     }

//     export function getAllowedChildTypes(node: CodeNode) {
//         let types: string[] = [];
//         if (Helpers.hasType(node, Types.scope)) {
//             types.push(Types.declaration);
//             types.push(Types.statement);
//             types.push(Types.func);
//         }
//         return types;
//     }

//     /// Typing is fast, don't force users to use mouse input to create values
//     /// everything can still be parsed
//     ///
//     /// As they're typing, show parsed results or origin of variable if unable to parse, or nothing
//     export function parseStringToVariable(str: string) : TypedValue | void {

//         if (str === 'true' || str === 'false') {
//             return {
//                 type: 'boolean',
//                 value: Boolean(str)
//             }
//         }
//         if (/"[^"]*"/.test(str)) {
//             return {
//                 type: 'string',
//                 value: str.substr(1, str.length - 2)
//             }
//         }
//         if (/\d*\.\d+/g.test(str)) {
//             return {
//                 type: 'float',
//                 value: parseFloat(str)
//             }
//         }
//         if (/\d+/.test(str)) {
//             return {
//                 type: 'integer', // TODO: Implement different variants of ints/floats e.g. int32, uint32, float16
//                 value: parseInt(str)
//             }
//         }
//         if (/\[.*\]/.test(str)) {
//             return parseArray(str);
//         }

//         // If what they've typed isn't a value, they must be referring to a variable
//         return null;
//     }

//     function parseArray(str: string) : TypedValue {
//         const removeBrackets = str.substr(1, str.length - 2);
//         return {
//             type: 'array',
//             value: str.split(',').map(s => parseStringToVariable(s))
//         }
//     }
// }

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
    display?: {[frontend: string] : any}
    
    type: CodeNodeType
    parent: CodeNode,    
}

export interface StructDefinitionNode {
    
}

export interface DeclarationNode extends CodeNode {
    mutable: boolean
    identifier: ValueNode,
    valueExpression?: ExpressionNode,
    typeExpression?: ExpressionNode
}

export interface ScopeNode extends CodeNode {
    children: CodeNode[]
}

export interface ImportNode extends CodeNode {
    identifier: string
}

export interface SwitchNode extends CodeNode {
    branches: {
        expression: ExpressionNode,
        body: ScopeNode
    }
}

export interface TypeDeclaration extends CodeNode {

    /**
     * Every type must have a unique identifier not equal to one already created, which includes those that are preexisting such as
     * string, boolean, array, int32 etc. 
     */
    typeIdentifier: string,
    
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
     */
    typeExpression: ExpressionNode 
}


export interface ExpressionNode extends CodeNode {
    expression: PrefixExpressionNode | BinaryExpressionNode | CallExpressionNode
}

export interface PrefixExpressionNode extends CodeNode {
    operator: string,
    subExpression: ExpressionNode 
}

export interface ValueNode extends CodeNode {
    value: any
}
export interface CallExpressionNode extends CodeNode {
    subExpression: ExpressionNode
    argument?: ExpressionNode
}
export interface BinaryExpressionNode extends CodeNode {
    lhs: ExpressionNode,
    operator: string,
    rhs: ExpressionNode
}
export interface StatementNode extends CodeNode {

}

export type ModuleChild = DeclarationNode | ExpressionNode;
export interface ModuleNode extends CodeNode {

    /**
     * Everything that comes under this module node inherits the version from its module. We use this to handle
     * changes in the language, and upgrade old code in a reliable way
     */
    version: string
    children: ModuleChild[]

    // IDEA: Short name and a fully qualified name for imports etc.
    identifier: string

    // IDEA: Some stuff to setup this module for the evironment if it calls code from another language/runtime so that the module
    // can be treated as if normal
}

/**
 * Used for input, should be able to be inserted anywhere
 * Can also put things like comments in here
 */
export interface TextNode extends ScopeNode {
    text: string
}

export interface FunctionNode extends ScopeNode {
    typeIdentifier: string
    identifier: string
}


export interface TestNode extends CodeNode {
    function: FunctionNode,
    tests: {input: ExpressionNode, output: ExpressionNode}[]
}

export function createProgram() : ModuleNode {
    return {
     children: []
    } as ModuleNode;
}

export interface TypedValue {
    type: string,
    value: any
}

