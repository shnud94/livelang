import * as AST from '../ast/index';
const types = AST.CodeNodeTypes;

interface BuiltInType<RawType> extends Type {
    rawValue: RawType
    defaultValue: RawType
}

type BuiltInTypeUpdater<RawType> = (value: RawType) => RawType
type TypeIdentifier = string; 

interface Type {
    identifier?: string
    type: string
}

const typeTypes = {
    any: 'any',
    value: 'value',
    map: 'map',
    array: 'array',
    generic: 'generic',
    callable: 'callable',
    or: 'or'
}
const t = typeTypes;

interface OrType extends Type {
    choices: Type[]
}

interface ValueType extends Type {}

interface MapType {
    map: {[key: string] : Type}
}

interface ArrayType extends Type {
    /**
     * One type says that the array is all of the same type,
     * but an array of types specifies a fixed length array of
     * particular types, i.e. tuples/function arguments
     */
    elementType: Type | Type[]
}

interface CallableType extends Type {
    output: Type,
    input: Type
}

function createArrayType(type: Type | Type[], identifier?: string) : ArrayType {
    return {
        identifier: identifier,
        type: t.array,
        elementType: type
    };
}

function createValueType(identifier: string) : ValueType {
    return {
        identifier: name,
        type: t.value
    };
}

function createOrType(choices: Type[], identifier?: string) : OrType {
    return {
        identifier: identifier,
        type: t.or,
        choices: choices
    };
}

function createCallableType(input: Type, output: Type, identifier?: string) : CallableType {
    return {
        identifier: identifier,
        type: t.callable,
        input: input,
        output: output
    };
}

// function createGenericType() : GenericType {

// }

export const BuiltInTypes = {
    any: createValueType('any'),
    
    string: createValueType('string'),
    
    int32: createValueType('int32'),
    int16: createValueType('int16'),
    int8: createValueType('int8'),

    uint32: createValueType('uint32'),
    uint16: createValueType('uint16'),
    uint8: createValueType('uint8'),

    float16: createValueType('float16'),
    float32: createValueType('float32'),

    boolean: createValueType('boolean'),
}
const b = BuiltInTypes;

function createBinaryOperatorTypes(op: string, types: Type[]) : OrType {
    const choices = types.map(type => createCallableType(createArrayType(type), type));
    return createOrType(choices, op);
}
function createUnaryOperatorTypes(op: string, types: Type[]) : OrType {
    const choices = types.map(type => createCallableType(type, type));
    return createOrType(choices, op);
}

const numericTypes = [b.int8, b.int16, b.int32, b.uint8, b.uint16, b.int32, b.float16, b.float32];
const builtIns = [].concat([numericTypes, b.string, b.boolean]);

export const BinaryOperators = {
    '+' : createBinaryOperatorTypes('+', [].concat(numericTypes, b.string)),
    '-' : createBinaryOperatorTypes('-', numericTypes),
    '/' : createBinaryOperatorTypes('/', numericTypes),
    '*' : createBinaryOperatorTypes('*', numericTypes),
    '%' : createBinaryOperatorTypes('%', numericTypes),

    '>' : createBinaryOperatorTypes('>', numericTypes),
    '>=' : createBinaryOperatorTypes('>=', numericTypes),
    '<' : createBinaryOperatorTypes('<', numericTypes),
    '<=' : createBinaryOperatorTypes('<=', numericTypes),

    '==' : createBinaryOperatorTypes('==', builtIns),
    '!=' : createBinaryOperatorTypes('!=', builtIns),
}

export const Operators = {
    '!' : createCallableType(b.boolean, b.boolean),
    '-' : createBinaryOperatorTypes('-', numericTypes)
}

export function typesMatch(a: Type, b: Type) {
    if (a.type === t.any) return true;

    if (a.type === t.value && b.type === t.value && a.identifier === b.identifier) {
        return true;
    }

    if (a.type === t.map && b.type === t.map) {


    }
}



export function typeFromLiteral(literal: AST.ValueNode) {

    
}

export function getTypes(module: AST.ModuleNode) {

    const typesByIdentifier = {};

    function processExpression(expression: AST.ExpressionNode) {

        const child = expression.expression;

        if (child.type === types.arrayLiteral) {
            // return array of most common parent type if possible
        }
        else if (child.type === types.numericLiteral) {
            // return int for no floating point, float for floating point
        }
        else if (child.type === types.stringLiteral) {
            // string
        }
        else if (child.type === types.prefixExpression) {
            const asPrefix = child as AST.PrefixExpressionNode;
            
        }
        else if (child.type === types.binaryExpression) {

        }
        else if (child.type === types.postfixExpression) {
            
        }
    }

    module.children.forEach(child => {
        
        if (child.type === types.declaration) {

            const dec = child as AST.DeclarationNode;      
        }
        else if (child.type === types.assignment) {

        }
        else if (child.type === types.expression) {
            
        }
    });
}