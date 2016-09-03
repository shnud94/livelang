import * as AST from '../ast/index';
import * as _ from 'underscore';
import * as util from '../util';
const log = require('debug')('livelang:typechecker');


export type TypeCheckError = TypeMismatchError | TypeErrorVague; 

export interface TypeErrorVague {
    kind: 'typeError',
    value: string,
    nodes: any[]
}

export interface TypeMismatchError {
    kind: 'typeMismatchError',
    lhs: {
        type: Type,
        value: any
    }
    rhs: {
        type: Type,
        value: any
    }
}

export interface TypeBase {
    identifier?: string
}

export type Type = TypeBase & (AndType | OrType | FunctionType<any, any> | MapType | ArrayType | ValueType | AnyType);

export interface AnyType extends TypeBase {
    type: 'any'
}

export interface AndType extends TypeBase {
    type: 'and',
    choices: Type[]
}

export interface OrType extends TypeBase {
    type: 'or',
    choices: Type[]
}

export interface ValueType extends TypeBase {
    type: 'value'
}


export interface MapType extends TypeBase {
    type: 'map'
    map: {[key: string] : Type}
}

export interface ArrayType extends TypeBase {
    type: 'array'
    /**
     * One type says that the array is all of the same type,
     * but an array of types specifies a fixed length array of
     * particular types, i.e. tuples/function arguments
     */
    elementType: Type | Type[]
}

export interface FunctionType<I, O> extends TypeBase {
    type: 'function'
    input: I
    output: O
}

export function getAnyType() : Type {
    return {
        identifier: 'any',
        type: 'any'
    }
}

export function createMapType(map: {[key: string] : Type}, identifier?: string) : MapType {
    return {
        identifier: identifier,
        type: 'map',
        map: map
    };
}

export function createArrayType(type: Type | Type[], identifier?: string) : ArrayType {
    return {
        identifier: identifier,
        type: 'array',
        elementType: type
    };
}

export function createValueType(identifier: string) : ValueType {
    return {
        identifier: identifier,
        type: 'value'
    };
}

export function createAndType(choices: Type[], identifier?: string) : AndType {
    return {
        identifier: identifier,
        type: 'and',
        choices: choices
    };
}

export function createOrType(choices: Type[], identifier?: string) : OrType {
    return {
        identifier: identifier,
        type: 'or',
        choices: choices
    };
}

export function createCallableType<I extends Type, O extends Type>(input: I, output: O, identifier?: string) : FunctionType<I, O> {
    return {
        identifier: identifier,
        type: 'function',
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
    float64: createValueType('float64'),

    boolean: createValueType('boolean'),

    null: createValueType('null')
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

export function isIntegerType(type: Type) {
    return type.type === 'value' && (
        type === b.int16 ||
        type === b.int32 || 
        type === b.int8 ||
        type === b.uint16 || 
        type === b.uint32 || 
        type === b.uint8
    );
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

        if (child.type.startsWith('expression')) {
            typeCheckExpression(child as AST.ExpressionType, context, rootScope);
        }
        else if (child.type === 'declaration') {
            typeCheckDeclaration(child, context, rootScope);
        }
        else if (child.type === 'assignment') {
            typeCheckAssignment(child, context, rootScope);
        }
    });

    return context;
}

// Think this is just for checking assignment
export function typesMatch(dest: Type, source: Type) : boolean {
    // Any type
    if (dest.type === 'any' || source.type === 'any') return true;

    if (dest.type !== source.type) {
        // Type of the types have to match
        return false;
    }

    if (dest.type === 'value' && source.type === 'value' && dest.identifier === source.identifier) {
        // Value type
        return true;
    }
    
    if (dest.type === 'map' && source.type === 'map') {
        // Map type
        const [mapDest, mapSource] = [dest as MapType, source as MapType]; 

        return _.keys(mapDest.map).every(key => {
            return mapSource.map[key] && typesMatch(mapDest[key], mapSource[key]);
        });
    }

    if (dest.type === 'array' && source.type == 'array') {
        // Array type
        const [arrayDest, arraySource] = [dest as ArrayType, source as ArrayType]; 

        if (Array.isArray(arrayDest.elementType) && Array.isArray(arraySource.elementType)) {
            return (arrayDest.elementType as Type[]).every((type, index) => typesMatch(type, arraySource[index]))
        }

        if (!Array.isArray(arrayDest.elementType) && !Array.isArray(arraySource.elementType)) {
            return typesMatch(arrayDest.elementType as Type, arraySource.elementType as Type);
        }
    }

    if (dest.type === 'or' && source.type === 'or') {
        // Or type
        const [orDest, orSource] = [dest as OrType, source as OrType]; 
        return orDest.choices.some((type, index) => typesMatch(type, orSource.choices[index]));
    }

    if (dest.type === 'and' && source.type === 'and') {
        // And type
        const [andDest, andSource] = [dest as AndType, source as AndType]; 
        return andDest.choices.every((type, index) => typesMatch(type, andSource.choices[index]));
    }

    return false;
}

export function createError(error: string, nodes: AST.CodeNode[] = []) : TypeErrorVague {
    return {
        kind: 'typeError',
        value: error,
        nodes: nodes
    }
}

export interface TypeCheckContext extends TypeCreationContext {
    rootScope: Scope
    resolveType: (identifier: string | Type) => Type
    errors: TypeCheckError[]
    warnings: TypeCheckError[]
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
            debugger;
            context.errors.push({
                kind: 'typeMismatchError',
                lhs: {
                    type: existing.type,
                    value: existing
                },
                rhs: {
                    type: expressionType,
                    value: declaration.valueExpression
                }  
            });
        }
        // Give declaration type precedence as we might want to cast to something specific
        declarationType = match ? (declarationType || expressionType) : getAnyType(); 
    }

    if (!declaration.typeExpression && !declaration.valueExpression) {
        context.warnings.push(createError('Unable to infer any type for identifier', [declaration]));
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

    if (expression.type === 'expressionidentifier') {
        
        if (expression.value === 'false' || expression.value === 'true') return BuiltInTypes.boolean;
        const resolved = resolveDeclarationByIdentifier(expression.value, scope);
        if (resolved && resolved.type) {
            return resolved.type;
        }   
        else {
            context.errors.push(createError(`Couldn't resolve type of $0`, [expression]));
            return getAnyType();
        }     
    }
    if (expression.type === 'expressionarrayLiteral') {

        const array = expression.value;
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
    else if (expression.type === 'expressionnumericLiteral') {
        
        // Numeric literal
        const asNumber = expression.value;
        if (asNumber % 1 === 0) {
            return BuiltInTypes.int32;
        }
        else {
            return BuiltInTypes.float32;
        }
    }
    else if (expression.type === 'expressionmapLiteral') {
        
        // Map literal
        return createMapType(util.mapObj(expression.value, (key, val) => {
            return [key, typeCheckExpression(val, context, scope)]
        }))
    }
    else if (expression.type === 'expressionstringLiteral') {
        return BuiltInTypes.string;
    }
    else if (expression.type === 'expressioncallExpression') {

        const inputType = typeCheckExpression(expression.input, context, scope);
        let functionType = typeCheckExpression(expression.target, context, scope);
        
        const checkFunction = (inputType: Type, func: FunctionType<any, any>) => {
            return typesMatch(func.input, inputType);
        }

        if (functionType.type === 'or') {
            const asOr = functionType as OrType;
            const foundMatch = asOr.choices.find(functionType => 
                functionType.type === 'function' && checkFunction(inputType, functionType as FunctionType<any, any>)
            ) as FunctionType<any, any>;
            if (foundMatch) {
                return foundMatch.output;
            }
            context.errors.push(createError(`Input for method $0 does not match declared`, [expression.target]));
            return getAnyType();
        }
        if (functionType.type !== 'function') {
            context.errors.push(createError(`Expression $0 is not callable`, [expression]));
            return getAnyType();
        }

        const asMethod = functionType as FunctionType<any, any>;        
        const inputMatches = typesMatch(asMethod.input, inputType);

        if (!inputMatches) {
            context.errors.push(createError(`Input for method $0 does not match declared`, [expression.target]));
        }

        return asMethod.output;
    }
    else if (expression.type === 'expressionmemberAccess') {

        const checkSubject = typeCheckExpression(expression.subject, context, scope);
        const memberType = typeCheckExpression(expression.member, context, scope);

        if (checkSubject.type === 'any') return getAnyType();

        if (checkSubject.type === 'map' && memberType === BuiltInTypes.string) {
            const asMapType = checkSubject as MapType;
            if (expression.member.type === 'expressionidentifier') {
                return asMapType[expression.member.value];
            }
            else {
                log(`dynamically accessing member of map, we can't yet say for sure if this exists`); 
                // compile time code execution required?
                return getAnyType();
            }
        }

        if (checkSubject.type === 'array' && isIntegerType(memberType)) {
            const asArrayType = checkSubject as ArrayType;
            if (expression.member.type === 'expressionnumericLiteral') {
                // We can do our best to do bounds checking here

                if (expression.member.value < 0 || (Array.isArray(asArrayType.elementType) && asArrayType.elementType.length <= expression.member.value)) {
                    context.errors.push(createError('array out of bounds index', [expression]));
                }

                return Array.isArray(asArrayType.elementType) ? asArrayType.elementType[expression.member.value] : asArrayType.elementType;
            }
            else {
                log(`dynamically accessing index of array, we can't yet say for sure if this exists`); 
                // compile time code execution required?
                return Array.isArray(asArrayType.elementType) ? getAnyType() : asArrayType.elementType;
            }
        }
    }
}

export function getTypeOfTypeExpression(typeExpression: AST.ExpressionType) : Type {

    // After here we assume typeExpression is an object
    if (typeExpression.type === 'expressionarrayLiteral') {

        return createArrayType(typeExpression.value.map(typeExpression => getTypeOfTypeExpression(typeExpression) as Type));
    }
    else if (typeExpression.type === 'expressionmapLiteral') {

        return createMapType(typeExpression.value);
    }
    else if (typeExpression.type === 'expressioncallableLiteral') {

        const argArrayType = createArrayType(typeExpression.input.map(arg => getTypeOfTypeExpression(arg.type)));
        return createCallableType(
            argArrayType,
            getTypeOfTypeExpression(typeExpression.output) as Type
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
        if (child.type === 'typeDeclaration') {

            const typeExpression = child.typeExpression;

            if (context.typesByIdentifier[child.identifier.value]) {
                console.error(`Declared same type twice with identifier ${child.identifier}`);
                console.error(`Not doing anything about this now m8 but be warned l8r on you will experinese problmz`);
            }
            context.typesByIdentifier[child.identifier.value] = getTypeOfTypeExpression(typeExpression);
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
        else if (type.type === 'array') {
            const asArrayType = type as ArrayType;
            
            if (Array.isArray(asArrayType)) {
                asArrayType.elementType = (asArrayType.elementType as Type[]).map(resolveType);
            }
            else {
                asArrayType.elementType = resolveType(asArrayType.elementType as Type);
            }
        }
        else if (type.type === 'map') {

            const asMap = type as MapType;
            _.keys(asMap).forEach(key => {
                asMap[key] = resolveType(asMap[key]);
            });
        }
        else if (type.type === 'function') {

            const asFunction = type as FunctionType<any, any>;
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