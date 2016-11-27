import {MapType, Type, ArrayType, OrType, AnyType, AndType, FunctionType, getAnyType, createArrayType, createCallableType, createMapType} from './index'; 
import * as Types from './index';
import {BuiltInTypes as b} from './builtin';
import * as AST from '../AST/index';
import * as util from '../util';
const log = require('debug')('livelang:typechecker');
import * as _ from 'underscore';

import * as numbers from '../interpreter/lib/number';
import * as arrays from '../interpreter/lib/array';


export type TypeCheckError = TypeMismatchError | TypeErrorVague | TypeErrorUndefined | GenericError; 

export type GenericError = {
    kind: 'generic',
    source: AST.Nodes,
    error: string
}

export type TypeErrorUndefined = {
    kind: 'typeUndefined',
    source: AST.Identifier
}

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
export function resolveMultipleDeclarationsByIdentifier(identifier: string, context: TypeCheckContext, scope: Scope) : AST.DeclarationNode[] {
    if (!scope) return null;        
    if (scope.declarationsByIdentifier[identifier]) return scope.declarationsByIdentifier[identifier];
    return resolveMultipleDeclarationsByIdentifier(identifier, context, scope.parent);
}

export function resolveDeclarationByIdentifier(identifier: string, context: TypeCheckContext, scope: Scope) : AST.DeclarationNode {
    const all = resolveMultipleDeclarationsByIdentifier(identifier, context, scope);
    if (all && all.length > 0) return all[0];
    return null;
}

export function getDeclarationSources(declaration: AST.DeclarationNode, scope: Scope, context: TypeCheckContext) : AST.DeclarationNode[] {
    if (declaration.valueExpression.type === 'expressionidentifier') {
        const identifier = declaration.valueExpression.value;
        const decs = resolveMultipleDeclarationsByIdentifier(identifier, context, scope);
        return _.flatten(decs.map(dec => getDeclarationSources(declaration, scope, context)));
    }
    return [declaration];
}

export function findMatchingFunction(identifier: string, args: Type, scope: Scope, context: ModuleTypeCheckContext, autocurry: boolean = true) : AST.CallableLiteral | null {
    const decs = resolveMultipleDeclarationsByIdentifier(identifier, context.typeCheckContext, scope);
    // Some declarations could be identifiers referring to a still earlier declaration, find the source!
    const sourceDecs = _.flatten(decs.map(d => getDeclarationSources(d, scope, context.typeCheckContext))) as AST.DeclarationNode[];

    for (let i = 0; i < sourceDecs.length; i++) {
        const dec = sourceDecs[i];
        const exprType = typeCheckExpression(dec.valueExpression, context, scope);
        if (exprType.kind !== 'function') continue;

        const callable = dec.valueExpression as AST.CallableLiteral;
        const inputType = createArrayType(callable.input.map(i => i.type));

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
    return type.kind === 'reference' && (
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

export function typeCheckModule(module: AST.ModuleNode, context?: ModuleTypeCheckContext) : {context: ModuleTypeCheckContext, type: MapType} {

    const rootScope: Scope = {
        children: [],
        declarationsByIdentifier: {} 
    }

    if (!context) {
        context = {
            module,
            rootScope: rootScope,
            typeCheckContext: {
                modules: [context],
                modulesByIdentifier() {
                    const c = context as any;
                    if (!c._modulesByIdentifier) {
                        c._modulesByIdentifier = _.indexBy(context.typeCheckContext.modules, module => module.module.identifier.value)
                    }
                    return c._modulesByIdentifier;
                },
                errors: [],
                resolveType: identifier => resolveTypeByIdentifier(identifier, context.typeCheckContext.typesByIdentifier),
                warnings: [],
                typesByIdentifier: {},
            }
        }

        seedTypeCheckContext(context.typeCheckContext);
        gatherTypes(module, context.typeCheckContext);
    }    

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
        [].concat(numbers.declarations, arrays.declarations)
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

    return {context, type: null};
}

// Think this is just for checking assignment
export function typesMatch(dest: Type, source: Type) : boolean {
    // Any type
    if (dest.kind === 'any' || source.kind === 'any') return true;

    if (dest.kind !== source.kind) {
        // Type of the types have to match
        return false;
    }

    if (dest.kind === 'reference' && source.kind === 'reference' && dest.identifier === source.identifier) {
        // These refer to the same type as far as I'm aware :O
        return true;
    }
    
    if (dest.kind === 'map' && source.kind === 'map') {
        // Map type
        const [mapDest, mapSource] = [dest as MapType, source as MapType]; 

        return _.keys(mapDest.map).every(key => {
            return mapSource.map[key] && typesMatch(mapDest[key], mapSource[key]);
        });
    }

    if (dest.kind === 'array' && source.kind == 'array') {
        // Array type
        const [arrayDest, arraySource] = [dest as ArrayType, source as ArrayType]; 

        if (Array.isArray(arrayDest.elementType) && Array.isArray(arraySource.elementType)) {
            return (arrayDest.elementType as Type[]).every((type, index) => typesMatch(type, arraySource.elementType[index]))
        }

        if (!Array.isArray(arrayDest.elementType) && !Array.isArray(arraySource.elementType)) {
            return typesMatch(arrayDest.elementType as Type, arraySource.elementType as Type);
        }
    }

    if (dest.kind === 'or' && source.kind === 'or') {
        // Or type
        const [orDest, orSource] = [dest as OrType, source as OrType]; 
        return orDest.choices.some((type, index) => typesMatch(type, orSource.choices[index]));
    }

    if (dest.kind === 'and' && source.kind === 'and') {
        // And type
        const [andDest, andSource] = [dest as AndType, source as AndType]; 
        return andDest.choices.every((type, index) => typesMatch(type, andSource.choices[index]));
    }

    if (dest.kind === 'function' && source.kind === 'function') {
        // Function type
        const [destFunc, sourceFunc] = [dest as FunctionType, source as FunctionType];
        return typesMatch(destFunc.output, sourceFunc.output) && typesMatch(destFunc.input, sourceFunc.input);
    }

    return false;
}

export function genericError(error: string, source: AST.Nodes) : GenericError {
    return {
        kind: 'generic',
        error,
        source
    }
}

export function createError(error: string, nodes: AST.CodeNode[] = []) : TypeErrorVague {
    return {
        kind: 'typeError',
        value: error,
        nodes: nodes
    }
}

export interface ModuleTypeCheckContext {
    typeCheckContext: TypeCheckContext
    module: AST.ModuleNode
    rootScope: Scope
}

export interface TypeCheckContext {
    modules: ModuleTypeCheckContext[]
    modulesByIdentifier: () => {[identifier: string] : ModuleTypeCheckContext}
    resolveType: (identifier: Type) => Type | null
    errors: TypeCheckError[]
    warnings: TypeCheckError[]
    /**
     * Not able to identify every type straight away,
     * while searching through we may find types that refer to other types
     * by their identifier that we haven't encountered yet
     */
    typesByIdentifier: {[identifier: string]: Type | string}
}

export function typeCheckDeclaration(declaration: AST.DeclarationNode, context: ModuleTypeCheckContext, scope: Scope) : Type {

    const typeCheckContext = context.typeCheckContext;
    let declarationType: Type;

    if (declaration.typeExpression && !declaration.flags.has('function')) { // Function types are always inferred automatically
        declarationType = typeCheckContext.resolveType(declaration.typeExpression);
    }

    if (declaration.valueExpression) {
        let expressionType = typeCheckExpression(declaration.valueExpression, context, scope);
        const match = typesMatch(declarationType || getAnyType(), expressionType);
        if (!match) {
            typeCheckContext.errors.push({
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
        typeCheckContext.warnings.push(createError('Unable to infer any type for identifier', [declaration]));
    }

    declarationType = declarationType || getAnyType();
    declaration._runtime = declaration._runtime || {};
    declaration._runtime.type = declarationType;
    const existing = resolveMultipleDeclarationsByIdentifier(declaration.identifier.value, typeCheckContext, scope);

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
                    if (match) typeCheckContext.errors.push(createError('Ambiguous function declaration, types identical', [declaration, other]));
                    return !match;
                });
            });
        }
        else {
            typeCheckContext.errors.push(createError(`Duplicate identifier '${declaration.identifier}, all but 1st ignored'`));
        }
    }
    else {
        scope.declarationsByIdentifier[declaration.identifier.value] = [declaration];
    }

    // No expression, just an empty declaration
    return declarationType
}

export function typeCheckAssignment(assignment: AST.AssignmentNode, modContext: ModuleTypeCheckContext, scope: Scope) : Type {
    
     const context = modContext.typeCheckContext;
     const declaration = resolveDeclarationByIdentifier(assignment.identifier.value, context, scope);
     if (!declaration) {
         context.errors.push(createError(`Unable to find variable ${assignment.identifier} to assign to`));
     }

     const decType = declaration._runtime.type || getAnyType();
     const expressionType = typeCheckExpression(assignment.valueExpression, modContext, scope);

     const match = typesMatch(decType, expressionType);
     if (!match) {
        console.error('Create our type error messages in the type match function itself?');   
     }

     return declaration._runtime.type;
}

export function resolveFunctionByIdentifier(identifier: string, match: {inputType?: Type, outputType?: Type}, context: ModuleTypeCheckContext, scope: Scope) : AST.CallableLiteral {
    // We assume all of these are callable literals, but they could not be, TODO: fix
    const found = resolveMultipleDeclarationsByIdentifier(identifier, context.typeCheckContext, scope);

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
        context.typeCheckContext.errors.push(createError('Function call is ambiguous'));
        return null;
    }
    if (matches.length === 0) { 
        context.typeCheckContext.errors.push(createError('Function has no matching input'));
        return null;
    }
    return matches[0].valueExpression as AST.CallableLiteral;
}

export function typeCheckExpression(expression: AST.ExpressionType, modContext: ModuleTypeCheckContext, scope: Scope) : Type {
    if (!expression) {
        return b.null;
    }

    const context = modContext.typeCheckContext;
    function getType() {
        
        if (expression.type === 'expressionidentifier') {
        
            // Strings of value false and true always resolve to type boolean
            if (expression.value === 'false' || expression.value === 'true') return b.boolean;

            const resolved = resolveDeclarationByIdentifier(expression.value, context, scope);
            
            // If we were able to resolve the type, i.e. it had been declared elsewhere, we can return
            // that resolved type
            if (resolved && resolved._runtime.type) {
                return resolved._runtime.type;
            }   
            else {
                context.errors.push({kind: 'typeUndefined', source: expression});
                return getAnyType();
            }     
        }
        if (expression.type === 'expressionarrayLiteral') {

            const array = expression.value;
            // return array of most common parent type if possible
            const childTypes = array.map(expression => typeCheckExpression(expression, modContext, scope));

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
                return [key, typeCheckExpression(val, modContext, scope)]
            }))
        }
        else if (expression.type === 'expressionstringLiteral') {
            return b.string;
        }
        else if (expression.type === 'expressioncallExpression') {

            const inputType = typeCheckExpression(expression.input, modContext, scope);

            // We resolve the callable here, why? We mostly want to do everything we can
            // in the type checking phase. Otherwise we defer until interpreter phase, which really
            // we just want to take stuff and do stuff instead of checking things and deciding things (I think?)
            let functionType: Type;
            let callable: AST.CallableLiteral;

            if (expression.target.type === 'expressionidentifier') {

                // Special functions
                if (expression.target.value === 'import') {

                    // Importing another module resolves to the type of that module
                    const arg = expression.input.value[0];
                    if (!arg || arg.type !== 'expressionIdentifier') {
                        context.errors.push(genericError('Must specify a module to import', expression));
                        return getAnyType();
                    }
                    
                    const identifier = arg as AST.Identifier;
                    const mod = context.modulesByIdentifier()[identifier.value];

                    if (!mod) {
                        context.errors.push(genericError(`Couldn't find a module named ${identifier.value}`, identifier));
                        return getAnyType();
                    }                    
                }

                callable = resolveFunctionByIdentifier(expression.target.value, {inputType}, modContext, scope);
                functionType = typeCheckExpression(callable, modContext, scope) as FunctionType;
            }       
            else {
                functionType = typeCheckExpression(expression.target, modContext, scope) as FunctionType;
            }
            
            const checkFunction = (inputType: Type, func: FunctionType) => {
                return typesMatch(func.input, inputType);
            }

            if (functionType.kind !== 'function') {
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

            const checkSubject = typeCheckExpression(expression.subject, modContext, scope);
            const memberType = typeCheckExpression(expression.member, modContext, scope);

            if (checkSubject.kind === 'any') return getAnyType();

            if (checkSubject.kind === 'map' && memberType === b.string) {
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

            if (checkSubject.kind === 'array' && isIntegerType(memberType)) {
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

            const argArrayType = createArrayType(expression.input.map(arg => arg.type));
            return createCallableType(
                argArrayType,
                expression.output
            )
        }
    }

    const type = getType();
    expression._runtime = expression._runtime || {};
    expression._runtime.type = type;
    return type;
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
        if (child.type === 'type' && child.identifier) {

            if (context.typesByIdentifier[child.identifier]) {
                console.error(`Declared same type twice with identifier ${child.identifier}`);
                console.error(`Not doing anything about this now m8 but be warned l8r on you will experinese problmz`);
            }
            context.typesByIdentifier[child.identifier] = child;            
        }
        if (child.type === 'scope' && child.flags.has('init')) {

            // This is where we could also run pre-type check interpreted stuff, like programatically adding types etc.
            child.children.forEach(initChild => {
                // Allow type declarations in here too, no problmz
                if (initChild.type === 'type') processChild(child);
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
        else if (type.kind === 'array') {
            const asArrayType = type as ArrayType;
            
            if (Array.isArray(asArrayType)) {
                asArrayType.elementType = (asArrayType.elementType as Type[]).map(resolveType);
            }
            else {
                asArrayType.elementType = resolveType(asArrayType.elementType as Type);
            }
        }
        else if (type.kind === 'map') {

            const asMap = type as MapType;
            _.keys(asMap).forEach(key => {
                asMap[key] = resolveType(asMap[key]);
            });
        }
        else if (type.kind === 'function') {

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
