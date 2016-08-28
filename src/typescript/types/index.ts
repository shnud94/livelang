import * as AST from '../ast/index';
import * as _ from 'underscore';
import * as util from '../util';
const types = AST.CodeNodeTypes;

interface BuiltInType<RawType> extends Type {
    rawValue: RawType
    defaultValue: RawType
}

type BuiltInTypeUpdater<RawType> = (value: RawType) => RawType
type TypeIdentifier = string; 

export interface Type {
    identifier?: string
    type: string
}

const typeTypes = {
    any: 'any',
    value: 'value',
    map: 'map',
    array: 'array',
    generic: 'generic',
    function: 'function',
    or: 'or',
    and: 'and'
}
const t = typeTypes;

export interface AndType extends Type {
    choices: Type[]
}

export interface OrType extends Type {
    choices: Type[]
}

export interface ValueType extends Type {}

export interface MapType extends Type {
    map: {[key: string] : Type}
}

export interface ArrayType extends Type {
    /**
     * One type says that the array is all of the same type,
     * but an array of types specifies a fixed length array of
     * particular types, i.e. tuples/function arguments
     */
    elementType: Type | Type[]
}

export interface FunctionType extends Type {
    output: Type,
    input: Type
}

export function getAnyType() : Type {
    return {
        type: t.any,
        identifier: 'any'
    }
}

export function createMapType(map: {[key: string] : Type}, identifier?: string) : MapType {
    return {
        identifier: identifier,
        type: t.map,
        map: map
    };
}

export function createArrayType(type: Type | Type[], identifier?: string) : ArrayType {
    return {
        identifier: identifier,
        type: t.array,
        elementType: type
    };
}

export function createValueType(identifier: string) : ValueType {
    return {
        identifier: identifier,
        type: t.value
    };
}

export function createAndType(choices: Type[], identifier?: string) : AndType {
    return {
        identifier: identifier,
        type: t.and,
        choices: choices
    };
}

export function createOrType(choices: Type[], identifier?: string) : OrType {
    return {
        identifier: identifier,
        type: t.or,
        choices: choices
    };
}

export function createCallableType(input: Type, output: Type, identifier?: string) : FunctionType {
    return {
        identifier: identifier,
        type: t.function,
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

export const BinaryOperators: {[key: string] : Type} = {
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

export const UnaryOperators: {[key: string] : Type} = {
    '!' : createCallableType(b.boolean, b.boolean),
    '-' : createBinaryOperatorTypes('-', numericTypes)
}

type DeclarationInfo = {
    declaration: AST.DeclarationNode,
    type: Type
}

type Scope = {
    parent?: Scope
    children: Scope[],
    declarationsByIdentifier: {[identifier: string] : DeclarationInfo}
}

function resolveDeclarationByIdentifier(identifier: string, scope: Scope) : DeclarationInfo {
    if (!scope) return null;        
    if (scope.declarationsByIdentifier[identifier]) return scope.declarationsByIdentifier[identifier];
    return resolveDeclarationByIdentifier(identifier, scope.parent);
}

function convertOperatorsToDeclarations(stringsNTypes: {[key: string] : Type}) : {[key: string] : DeclarationInfo} {
    return util.mapObj(stringsNTypes, (key, value) => {
        return [key, {type: value, declaration: null}];
    });
}


/**
 * Inserts built in library functions into the type check context
 */
export function seedTypeCheckContext(context: TypeCheckContext) {
    _.extend(context.rootScope.declarationsByIdentifier, convertOperatorsToDeclarations(BinaryOperators));
    _.extend(context.rootScope.declarationsByIdentifier, convertOperatorsToDeclarations(UnaryOperators));
    _.extend(context.typesByIdentifier, BuiltInTypes);
}

export function typeCheckModule(module: AST.ModuleNode, context?: TypeCheckContext) : TypeCheckContext {

    const rootScope: Scope = {
        children: [],
        declarationsByIdentifier: {} 
    }

    if (!context) {
        context = {
            errors: [],
            rootScope: rootScope,
            resolveType: identifier => resolveTypeByIdentifier(identifier, context.typesByIdentifier),
            typesByIdentifier: {},
            warnings: []
        };
    }    
    seedTypeCheckContext(context);

    module.children.forEach(child => {
        const asCodeNode = child as any as AST.CodeNode;
        if (typeof(child) !== 'object') return;

        if (asCodeNode.type.startsWith('expression')) {
            typeCheckExpression(child as any, context, rootScope);
        }
        else if (asCodeNode.type === AST.CodeNodeTypes.declaration) {
            typeCheckDeclaration(child as AST.DeclarationNode, context, rootScope);
        }
        else if (asCodeNode.type === AST.CodeNodeTypes.assignment) {
            typeCheckAssignment(child as AST.AssignmentNode, context, rootScope);
        }
    });

    return context;
}

// Think this is just for checking assignment
export function typesMatch(dest: Type, source: Type) : boolean {
    // Any type
    if (dest.type === t.any || source.type === t.any) return true;

    if (dest.type !== source.type) {
        // Type of the types have to match
        return false;
    }

    if (dest.type === t.value && source.type === t.value && dest.identifier === source.identifier) {
        // Value type
        return true;
    }
    
    if (dest.type === t.map && source.type === t.map) {
        // Map type
        const [mapDest, mapSource] = [dest as MapType, source as MapType]; 

        return _.keys(mapDest.map).every(key => {
            return mapSource.map[key] && typesMatch(mapDest[key], mapSource[key]);
        });
    }

    if (dest.type === t.array && source.type == t.array) {
        // Array type
        const [arrayDest, arraySource] = [dest as ArrayType, source as ArrayType]; 

        if (Array.isArray(arrayDest.elementType) && Array.isArray(arraySource.elementType)) {
            return (arrayDest.elementType as Type[]).every((type, index) => typesMatch(type, arraySource[index]))
        }

        if (!Array.isArray(arrayDest.elementType) && !Array.isArray(arraySource.elementType)) {
            return typesMatch(arrayDest.elementType as Type, arraySource.elementType as Type);
        }
    }

    if (dest.type === t.or && source.type === t.or) {
        // Or type
        const [orDest, orSource] = [dest as OrType, source as OrType]; 
        return orDest.choices.some((type, index) => typesMatch(type, orSource.choices[index]));
    }

    if (dest.type === t.and && source.type === t.and) {
        // And type
        const [andDest, andSource] = [dest as AndType, source as AndType]; 
        return andDest.choices.every((type, index) => typesMatch(type, andSource.choices[index]));
    }

    return false;
}

export function createError(error: string, nodes: AST.CodeNode[] = []) : TypeCheckContextError {
    return {
        errorString: error,
        nodes: nodes
    }
}

interface TypeCheckContextError {
    errorString: string,
    nodes: AST.CodeNode[]
}

export interface TypeCheckContext extends TypeCreationContext {
    rootScope: Scope
    resolveType: (identifier: string | Type) => Type
    errors: TypeCheckContextError[]
    warnings: string[]
}

interface TypeCreationContext {
    typesByIdentifier: {[identifier: string]: Type | string}
}

export function typeCheckDeclaration(declaration: AST.DeclarationNode, context: TypeCheckContext, scope: Scope) : Type {

    const existing = resolveDeclarationByIdentifier(declaration.identifier.value, scope);

    let declarationType: Type;

    if (declaration.typeExpression) {
        declarationType = context.resolveType(getTypeOfTypeExpression(declaration.typeExpression));
    }

    if (declaration.valueExpression) {
        let expressionType = typeCheckExpression(declaration.valueExpression, context, scope);
        const match = typesMatch(declarationType || getAnyType(), expressionType);
        if (!match) {
            context.errors.push(createError(`Types weren't assignable bruh`));
        }
        // Give declaration type precedence as we might want to cast to something specific
        declarationType = match ? (declarationType || expressionType) : getAnyType(); 
    }

    declarationType = declarationType || getAnyType();

    if (existing) {
        context.errors.push(createError(`Duplicate identifier '${declaration.identifier}, all but 1st ignored'`));
    }
    else {
        scope.declarationsByIdentifier[declaration.identifier.value] = {
            declaration: declaration,
            type: declarationType
        }
    }

    // No expression, just an empty declaration
    return declarationType
}

export function typeCheckAssignment(assignment: AST.AssignmentNode, context: TypeCheckContext, scope: Scope) : Type {
    
     const declaration = resolveDeclarationByIdentifier(assignment.identifier.value, scope);
     if (!declaration) {
         context.errors.push(createError(`Unable to find variable ${assignment.identifier} to assign to`));
     }

     const decType = declaration.type || getAnyType();
     const expressionType = typeCheckExpression(assignment.valueExpression, context, scope);

     const match = typesMatch(decType, expressionType);
     if (!match) {
        console.error('Create our type error messages in the type match function itself?');   
     }

     return declaration.type;
}

export function typeCheckExpression(expression: AST.ExpressionType, context: TypeCheckContext, scope: Scope) : Type {

    if (expression.type === types.identifier) {
        const asIdentifier = expression as AST.Identifier;
        if (asIdentifier.value === 'false' || asIdentifier.value === 'true') return BuiltInTypes.boolean;
        const resolved = resolveDeclarationByIdentifier(asIdentifier.value, scope);
        if (resolved && resolved.type) {
            return resolved.type;
        }   
        else {
            debugger;
            context.errors.push(createError(`Couldn't resolve type of $0`, [asIdentifier]));
            return getAnyType();
        }     
    }
    if (expression.type === types.arrayLiteral) {

        // Array literal
        const asValueNode = expression as AST.ArrayLiteralNode;
        const array = asValueNode.value;

        // return array of most common parent type if possible
        const childTypes = array.map(expression => typeCheckExpression(expression, context, scope));

        let allAssignable = true;
        const sameType = childTypes.reduce((prev, curr) => {

            if (prev && allAssignable) {
                allAssignable = typesMatch(prev, curr);
            }                
            return curr;

        }, null as Type);
        
        if (allAssignable) return createArrayType(childTypes[0]);
        return createArrayType(childTypes);
    }
    else if (expression.type === types.numericLiteral) {
        
        // Numeric literal
        const asValueNode = expression as AST.NumericLiteralNode;
        const asNumber = asValueNode.value;
        if (asNumber % 1 === 0) {
            return BuiltInTypes.int32;
        }
        else {
            return BuiltInTypes.float32;
        }
    }
    else if (expression.type === types.mapLiteral) {
        
        // Map literal
        const asValueNode = expression as AST.MapLiteralNode;
        return createMapType(util.mapObj(asValueNode.value, (key, val) => {
            return [key, typeCheckExpression(val, context, scope)]
        }))
    }
    else if (expression.type === types.stringLiteral) {
        return BuiltInTypes.string;
    }
    else if (expression.type === types.callExpression) {

        const asCallExpression = expression as AST.CallExpressionNode;
        const inputType = typeCheckExpression(asCallExpression.input, context, scope);
        let functionType = typeCheckExpression(asCallExpression.target, context, scope);
        
        const checkFunction = (inputType: Type, func: FunctionType) => {
            return typesMatch(func.input, inputType);
        }

        if (functionType.type === t.or) {
            const asOr = functionType as OrType;
            const foundMatch = asOr.choices.find(functionType => 
                functionType.type === t.function && checkFunction(inputType, functionType as FunctionType)
            ) as FunctionType;
            if (foundMatch) {
                return foundMatch.output;
            }
            context.errors.push(createError(`Input for method $0 does not match declared`, [asCallExpression.target]));
            return getAnyType();
        }
        if (functionType.type !== t.function) {
            context.errors.push(createError(`Expression $0 is not callable`, [expression]));
            return getAnyType();
        }

        const asMethod = functionType as FunctionType;        
        const inputMatches = typesMatch(asMethod.input, inputType);

        if (!inputMatches) {
            context.errors.push(createError(`Input for method $0 does not match declared`, [asCallExpression.target]));
        }

        return asMethod.output;
    }
}

export function getTypeOfTypeExpression(typeExpression: AST.ExpressionType) : Type | string {

    const asCodeNode = typeExpression as any as AST.CodeNode;

    if (typeof(typeExpression) === 'string') {
        return typeExpression as any as string;
    }
    // After here we assume typeExpression is an object
    else if (asCodeNode.type === AST.CodeNodeTypes.arrayLiteral) {

        const asArrayLiteral = asCodeNode as AST.ArrayLiteralNode;
        const array = asArrayLiteral.value;
        return createArrayType(array.map(typeExpression => getTypeOfTypeExpression(typeExpression) as Type));
    }
    else if (asCodeNode.type === AST.CodeNodeTypes.mapLiteral) {

        const asMapLiteral = asCodeNode as AST.MapLiteralNode;
        const object = asMapLiteral.value as {[key: string] : Type};
        return createMapType(object);
    }
    else if (asCodeNode.type === AST.CodeNodeTypes.callableLiteral) {

        const asCallable = asCodeNode as AST.CallableLiteral;
        return createCallableType(
            getTypeOfTypeExpression(asCallable.input) as Type, 
            getTypeOfTypeExpression(asCallable.output) as Type
        )
    }
}

export function resolveTypeByIdentifier(type: string | Type, typesByIdentifier: {[identifier: string] : Type | String}) : Type {
    if (typeof(type) !== 'string') return type as Type;
    
    const identifier = type as string;
    const result = typesByIdentifier[identifier];

    if (!result) {
        // This will then get caught by the final process 
        // that checks to see all types have been resolved
        console.error(`Type ${type} was not declared anywhere`);
        return type as any; 
    }

    if (typeof(result) === 'string') return resolveTypeByIdentifier(result as string, typesByIdentifier);
    return result as Type;
}

export function getTypes(module: AST.ModuleNode) : {[identifier: string] : Type} {

    const context: TypeCreationContext = {
        typesByIdentifier: {}
    };    

    module.children.forEach(child => {
        if (child.type === types.typeDeclaration) {

            const typeDec = child as AST.TypeDeclaration;
            const typeExpression = typeDec.typeExpression;

            if (context.typesByIdentifier[typeDec.identifier.value]) {
                console.error(`Declared same type twice with identifier ${typeDec.identifier}`);
                console.error(`Not doing anything about this now m8 but be warned l8r on you will experinese problmz`);
            }
            context.typesByIdentifier[typeDec.identifier.value] = getTypeOfTypeExpression(typeExpression);
        }
    });

    const resolveType = (type: string | Type) => resolveTypeByIdentifier(type, context.typesByIdentifier);

    _.keys(context.typesByIdentifier).forEach(identifier => {

        const typeOrIdentifier = context.typesByIdentifier[identifier];
        const type = typeOrIdentifier as Type;

        if (typeof(typeOrIdentifier) === 'string') {
            
            const asString = typeOrIdentifier as string;
            context.typesByIdentifier[identifier] = resolveType(asString);
        }
        else if (type.type === t.array) {
            const asArrayType = type as ArrayType;
            
            if (Array.isArray(asArrayType)) {
                asArrayType.elementType = (asArrayType.elementType as Type[]).map(resolveType);
            }
            else {
                asArrayType.elementType = resolveType(asArrayType.elementType as Type);
            }
        }
        else if (type.type === t.map) {

            const asMap = type as MapType;
            _.keys(asMap).forEach(key => {
                asMap[key] = resolveType(asMap[key]);
            });
        }
        else if (type.type === t.function) {

            const asFunction = type as FunctionType;
            asFunction.input = resolveType(asFunction.input);
            asFunction.output = resolveType(asFunction.output);
        }
    });

    const unresolved = _.values(context.typesByIdentifier).filter(type => typeof(type) === 'string');
    if (unresolved.length > 0) {
        console.error('You got some unresoled types there BOI');
    }
    
    return context.typesByIdentifier as {[identifier: string] : Type};    
}