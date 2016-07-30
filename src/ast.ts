export type CodeNodeType = string;
export namespace CodeNodeTypes {
    export const variableDeclaration: CodeNodeType = "declaration/variable";
    export const expression: CodeNodeType = "expression";
    export const expressionBinary: CodeNodeType = "expression/binary";
    export const statement: CodeNodeType = "statement";

    export const switchNode: CodeNodeType = "switch";

    export const literalNode: CodeNodeType = "literal";

    export const scope: CodeNodeType = "scope";
    export const module: CodeNodeType = "scope/module";
    export const func: CodeNodeType = "scope/function";
   
    export const test: CodeNodeType = "test";

    export const noop: CodeNodeType = "noop";
}
export const Types = CodeNodeTypes;

export namespace Helpers {
    
    export function hasType(node: CodeNode, type: CodeNodeType) {
        return node.type.split('/').indexOf(type) >= 0;
    } 

    export function hasChildren(node: CodeNode) {
        return Helpers.hasType(node, Types.scope);
    }

    export function maybeChildren(node: CodeNode) : CodeNode[] {
        if (Helpers.hasType(node, Types.scope)) {
            return (node as ScopeNode).children;
        }
        return [];
    }

    export function declaredIdentifiersAtNode(node: CodeNode, searchSource: CodeNode = node) : CodeNode[] {
        if (!node.parent) {
            return [];
        }

        let identifiersHere: CodeNode[] = [];
        let children = this.maybeChildren(node);
        
        // Only add children up to source if source is child,
        // i.e. declared variables after the source are not available yet
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child._id === searchSource._id) {
                break;
            }
            identifiersHere = identifiersHere.concat(child);
        }

        return identifiersHere.concat(this.declaredIdentifiersAtNode(node.parent));
    }

    export function getAllowedChildTypes(node: CodeNode) {
        let types: string[] = [];
        if (Helpers.hasType(node, Types.scope)) {
            types.push(Types.variableDeclaration);
            types.push(Types.statement);
            types.push(Types.func);
        }
        return types;
    }

    /// Typing is fast, don't force users to use mouse input to create values
    /// everything can still be parsed
    ///
    /// As they're typing, show parsed results or origin of variable if unable to parse, or nothing
    export function parseStringToVariable(str: string) : TypedValue | void {

        if (str === 'true' || str === 'false') {
            return {
                type: 'boolean',
                value: Boolean(str)
            }
        }
        if (/"[^"]*"/.test(str)) {
            return {
                type: 'string',
                value: str.substr(1, str.length - 2)
            }
        }
        if (/\d*\.\d+/g.test(str)) {
            return {
                type: 'float',
                value: parseFloat(str)
            }
        }
        if (/\d+/.test(str)) {
            return {
                type: 'integer', // TODO: Implement different variants of ints/floats e.g. int32, uint32, float16
                value: parseInt(str)
            }
        }
        if (/\[.*\]/.test(str)) {
            return parseArray(str);
        }

        // If what they've typed isn't a value, they must be referring to a variable
        return null;
    }

    function parseArray(str: string) : TypedValue {
        const removeBrackets = str.substr(1, str.length - 2);
        return {
            type: 'array',
            value: str.split(',').map(s => parseStringToVariable(s))
        }
    }
}

export interface CodeNode {
    type: CodeNodeType
    _id: string
    parent: CodeNode
}

export interface StructDefinitionNode {
    
}

export interface VariableDeclarationNode extends CodeNode {
    mutable: boolean
    identifier: string
    initialValue: ExpressionNode | LiteralNode
}

export interface ScopeNode extends CodeNode {
    children: CodeNode[]
}

export interface LiteralNode extends CodeNode {
    value: TypedValue
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

export interface ExpressionNode extends CodeNode {}
export interface BinaryExpressionNode extends ExpressionNode {

}

export interface StatementNode extends CodeNode {

}

export interface ModuleNode extends ScopeNode {
    children: CodeNode[]
    identifier: string
}

export interface FunctionNode extends ScopeNode {
    statements: StatementNode[]
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

