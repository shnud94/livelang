import {MapType, Type, ArrayType, OrType, AnyType, AndType, FunctionType, getAnyType, createArrayType, createCallableType, createMapType} from './index'; 
import {BuiltInTypes as b} from './builtin';
import * as AST from '../AST/index';
import * as util from '../util';
const log = require('debug')('livelang:typechecker');
import * as _ from 'underscore';
import * as numbers from '../interpreter/lib/number';

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

type Scope = {
    parent?: Scope
    children: Scope[],
    declarationsByIdentifier: {[identifier: string] : AST.DeclarationNode[]}
}

/**
 * With some declarations, such as functions, it is valid to have multiple declarations with the same identifier. These are distinguised
 * by their type parameters. This should probably only really be used for that purpose
 */
export function resolveMultipleDeclarationsByIdentifier(identifier: string, scope: Scope) : AST.DeclarationNode[] {
    if (!scope) return null;        
    if (scope.declarationsByIdentifier[identifier]) return scope.declarationsByIdentifier[identifier];
    return resolveMultipleDeclarationsByIdentifier(identifier, scope.parent);
}

export function resolveDeclarationByIdentifier(identifier: string, scope: Scope) : AST.DeclarationNode {
    const all = resolveMultipleDeclarationsByIdentifier(identifier, scope);
    if (all && all.length > 0) return all[0];
    return null;
}

export function getDeclarationSources(declaration: AST.DeclarationNode, scope: Scope, context: TypeCheckContext) : AST.DeclarationNode[] {
    if (declaration.valueExpression.type === 'expressionidentifier') {
        const identifier = declaration.valueExpression.value;
        const decs = resolveMultipleDeclarationsByIdentifier(identifier, scope);
        return _.flatten(decs.map(dec => getDeclarationSources(declaration, scope, context)));
    }
    return [declaration];
}

export function findMatchingFunction(identifier: string, args: Type, scope: Scope, context: TypeCheckContext, autocurry: boolean = true) : AST.CallableLiteral | null {
    const decs = resolveMultipleDeclarationsByIdentifier(identifier, scope);
    // Some declarations could be identifiers referring to a still earlier declaration, find the source!
    const sourceDecs = _.flatten(decs.map(d => getDeclarationSources(d, scope, context))) as AST.DeclarationNode[];

    for (let i = 0; i < sourceDecs.length; i++) {
        const dec = sourceDecs[i];
        const exprType = typeCheckExpression(dec.valueExpression, context, scope);
        if (exprType.type !== 'function') continue;

        const callable = dec.valueExpression as AST.CallableLiteral;
        const inputType = callableInputType(callable, context);

        if (typesMatch(inputType, args)) {
            return callable;
        }

        // TODO: Return a curried function if they don't match
    }

    return null;
}

// export function compatibleFunctionsForType(type: Type, scope: Scope, context: TypeCheckContext) : AST.DeclarationNode[] {
//     return _.flatten(_.values(scope.declarationsByIdentifier)).filter((declaration: AST.DeclarationNode) => {


//         const expressionType = typeCheckExpression(declaration.valueExpression, context, scope);
//         if (expressionType.type )
//         return declaration.valueExpression as 
//     }).concat(scope.parent ? compatibleFunctionsForType(type, scope.parent, context) : []);
// }

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

export function seedTypeCheckContext(context: TypeCheckContext) {
    _.extend(context.typesByIdentifier, b);    
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
    gatherTypes(module, context);

    function processChild(child: AST.ModuleChild) {
        if (child.type.startsWith('expression')) {
            typeCheckExpression(child as AST.ExpressionType, context, rootScope);
        }
        else if (child.type === 'declaration') {
            typeCheckDeclaration(child, context, rootScope);
        }
        else if (child.type === 'assignment') {
            typeCheckAssignment(child, context, rootScope);
        }
    }

    const libraryDeclarations: AST.DeclarationNode[] = _.flatten([
        [].concat(_.values(numbers))
    ]);
    libraryDeclarations.forEach(processChild);

    // TODO: Prepopulate all declarations by identifier

    module.children.forEach(child => {
        // Process init blocks first
        if (child.type === 'scope' && child.flags.has('init')) {
            child.children.forEach(processChild);
        }
    });
    
    module.children.forEach(processChild);

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
            return (arrayDest.elementType as Type[]).every((type, index) => typesMatch(type, arraySource.elementType[index]))
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

    if (dest.type === 'function' && source.type === 'function') {
        // Function type
        const [destFunc, sourceFunc] = [dest as FunctionType, source as FunctionType];
        return typesMatch(destFunc.output, sourceFunc.output) && typesMatch(destFunc.input, sourceFunc.input);
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

    /**
     * Not able to identify every type straight away,
     * while searching through we may find types that refer to other types
     * by their identifier that we haven't encountered yet
     */
    typesByIdentifier: {[identifier: string]: Type | string}
}

export function typeCheckDeclaration(declaration: AST.DeclarationNode, context: TypeCheckContext, scope: Scope) : Type {

    let declarationType: Type;

    if (declaration.typeExpression && !declaration.flags.has('function')) { // Function types are always inferred automatically
        declarationType = context.resolveType(getTypeOfTypeExpression(declaration.typeExpression, context));
    }

    if (declaration.valueExpression) {
        let expressionType = typeCheckExpression(declaration.valueExpression, context, scope);
        const match = typesMatch(declarationType || getAnyType(), expressionType);
        if (!match) {
            context.errors.push({
                kind: 'typeMismatchError',
                lhs: {
                    type: declarationType,
                    value: declaration.typeExpression
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
    declaration._runtime = declaration._runtime || {};
    declaration._runtime.type = declarationType;
    const existing = resolveMultipleDeclarationsByIdentifier(declaration.identifier.value, scope);

    if (existing) {
        if (declaration.flags.has('function')) {
            // It's okay, we can have multiple under same identifier, just ensure they have different typed operands that
            // we can use to differentiate by
            scope.declarationsByIdentifier[declaration.identifier.value].push(declaration);
            const allUnique = scope.declarationsByIdentifier[declaration.identifier.value].every((declaration, i, array) => {
                return array.every((other, i2, array) => {
                    if (i2 === i) return true; // Will encounter ourselves in this list, skip that one

                    // Make sure types are not assignable, i.e. all are unique
                    const match = typesMatch(declaration._runtime.type, other._runtime.type);
                    if (match) context.errors.push(createError('Ambiguous function declaration, types identical', [declaration, other]));
                    return !match;
                });
            });
        }
        else {
            context.errors.push(createError(`Duplicate identifier '${declaration.identifier}, all but 1st ignored'`));
        }
    }
    else {
        scope.declarationsByIdentifier[declaration.identifier.value] = [declaration];
    }

    // No expression, just an empty declaration
    return declarationType
}

export function typeCheckAssignment(assignment: AST.AssignmentNode, context: TypeCheckContext, scope: Scope) : Type {
    
     const declaration = resolveDeclarationByIdentifier(assignment.identifier.value, scope);
     if (!declaration) {
         context.errors.push(createError(`Unable to find variable ${assignment.identifier} to assign to`));
     }

     const decType = declaration._runtime.type || getAnyType();
     const expressionType = typeCheckExpression(assignment.valueExpression, context, scope);

     const match = typesMatch(decType, expressionType);
     if (!match) {
        console.error('Create our type error messages in the type match function itself?');   
     }

     return declaration._runtime.type;
}

export function resolveFunctionByIdentifier(identifier: string, match: {inputType?: Type, outputType?: Type}, context: TypeCheckContext, scope: Scope) : AST.CallableLiteral {
    // We assume all of these are callable literals, but they could not be, TODO: fix
    const found = resolveMultipleDeclarationsByIdentifier(identifier, scope);

    if (!found || found.length === 0) return null;

    const matches = found.filter(decl => {
        const functionType = typeCheckExpression(decl.valueExpression, context, scope) as FunctionType;
        if (match.inputType && !typesMatch(functionType.input, match.inputType)) {
            return false;
        }
        if (match.outputType && !typesMatch(functionType.output, match.outputType)) {
            return false;
        }

        return true;
    });

    if (matches.length > 1) {
        context.errors.push(createError('Function call is ambiguous'));
        return null;
    }
    if (matches.length === 0) { 
        context.errors.push(createError('Function has no matching input'));
        return null;
    }
    return matches[0].valueExpression as AST.CallableLiteral;
}

export function typeCheckExpression(expression: AST.ExpressionType, context: TypeCheckContext, scope: Scope) : Type {
    if (!expression) {
        return b.null;
    }

    function getType() {
        
        if (expression.type === 'expressionidentifier') {
        
            if (expression.value === 'false' || expression.value === 'true') return b.boolean;
            const resolved = resolveDeclarationByIdentifier(expression.value, scope);
            if (resolved && resolved._runtime.type) {
                return resolved._runtime.type;
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

            // let allAssignable = true;
            // const sameType = childTypes.reduce((prev, curr) => {

            //     if (prev && allAssignable) {
            //         allAssignable = typesMatch(prev, curr);
            //     }                
            //     return curr;

            // }, null as Type);
            
            // if (allAssignable) return createArrayType(childTypes[0]);
            return createArrayType(childTypes);
        }
        else if (expression.type === 'expressionnumericLiteral') {
            
            // Numeric literal
            const asNumber = expression.value;
            if (asNumber % 1 === 0) {
                return b.int32;
            }
            else {
                return b.float32;
            }
        }
        else if (expression.type === 'expressionmapLiteral') {
            
            // Map literal
            return createMapType(util.mapObj(expression.value, (key, val) => {
                return [key, typeCheckExpression(val, context, scope)]
            }))
        }
        else if (expression.type === 'expressionstringLiteral') {
            return b.string;
        }
        else if (expression.type === 'expressioncallExpression') {

            const inputType = typeCheckExpression(expression.input, context, scope);

            // We resolve the callable here, why? We mostly want to do everything we can
            // in the type checking phase. Otherwise we defer until interpreter phase, which really
            // we just want to take stuff and do stuff instead of checking things and deciding things (I think?)
            let functionType: Type;
            let callable: AST.CallableLiteral;

            if (expression.target.type === 'expressionidentifier') {
                callable = resolveFunctionByIdentifier(expression.target.value, {inputType: inputType}, context, scope);
                functionType = typeCheckExpression(callable, context, scope) as FunctionType;
            }       
            else {
                functionType = typeCheckExpression(expression.target, context, scope) as FunctionType;
            }
            
            const checkFunction = (inputType: Type, func: FunctionType) => {
                return typesMatch(func.input, inputType);
            }

            if (functionType.type !== 'function') {
                context.errors.push(createError(`Expression $0 is not callable`, [expression]));
                return getAnyType();
            }

            const asMethod = functionType as FunctionType;        
            const inputMatches = typesMatch(asMethod.input, inputType);

            if (!inputMatches) {
                context.errors.push(createError(`Input for method $0 does not match declared`, [expression.target]));
            }

            expression._runtime = expression._runtime || {target: callable};
            expression._runtime.target = callable;
            return asMethod.output;
        }
        else if (expression.type === 'expressionmemberAccess') {

            const checkSubject = typeCheckExpression(expression.subject, context, scope);
            const memberType = typeCheckExpression(expression.member, context, scope);

            if (checkSubject.type === 'any') return getAnyType();

            if (checkSubject.type === 'map' && memberType === b.string) {
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

            // Nothing found? Magically fall back to finding a function in scope that has this type as its first
            // argument. Potentially gonna be slowwwww...
        }
        else if (expression.type === 'expressioncallableLiteral') {

            const argArrayType = createArrayType(expression.input.map(arg => getTypeOfTypeExpression(arg.type, context)));
            return createCallableType(
                argArrayType,
                getTypeOfTypeExpression(expression.output, context) as Type
            )
        }
    }

    const type = getType();
    expression._runtime = expression._runtime || {};
    expression._runtime.type = type;
    return type;
}

export function callableInputType(callable: AST.CallableLiteral, context: TypeCheckContext) : ArrayType {
    return createArrayType(callable.input.map(i => getTypeOfTypeExpression(i.type, context)));
}

export function getTypeOfTypeExpression(typeExpression: AST.ExpressionType, context: TypeCheckContext) : Type {

    // After here we assume typeExpression is an object
    if (typeExpression.type === 'expressionarrayLiteral') {
        return createArrayType(typeExpression.value.map(typeExpression => getTypeOfTypeExpression(typeExpression, context) as Type));
    }
    else if (typeExpression.type === 'expressionmapLiteral') {
        return createMapType(typeExpression.value);
    }
    else if (typeExpression.type === 'expressionidentifier') {
        return context.resolveType(typeExpression.value);
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

/**
 * The very first step in type checking, before we do anything else we need to know about all the types that exist
 */
export function gatherTypes(module: AST.ModuleNode, context: TypeCheckContext) : {[identifier: string] : Type} {

    function processChild(child: AST.ModuleChild) {
        if (child.type === 'typeDeclaration') {

            const typeExpression = child.typeExpression;

            if (context.typesByIdentifier[child.identifier.value]) {
                console.error(`Declared same type twice with identifier ${child.identifier}`);
                console.error(`Not doing anything about this now m8 but be warned l8r on you will experinese problmz`);
            }
            context.typesByIdentifier[child.identifier.value] = getTypeOfTypeExpression(typeExpression, context);            
        }
        if (child.type === 'scope' && child.flags.has('init')) {

            // This is where we could also run pre-type check interpreted stuff, like programatically adding types etc.
            child.children.forEach(initChild => {
                // Allow type declarations in here too, no problmz
                if (initChild.type === 'typeDeclaration') processChild(child);
            });
        }
    }

    module.children.forEach(processChild);

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
