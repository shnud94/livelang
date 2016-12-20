import {
    UnresolvedType, MapType, Type, ArrayType, OrType, AnyType, AndType, FunctionType, getAnyType, createArrayType,
    createCallableType, createMapType, createOrType
} from './index';
import * as Types from './index';
import { BuiltInTypes as b } from './builtin';
import * as AST from '../AST/index';
import * as util from '../util';
const log = require('debug')('livelang:typechecker');
import * as _ from 'underscore';
import * as numbers from '../interpreter/lib/number';
import * as arrays from '../interpreter/lib/array';
import {identifier} from "../frontend/javascriptStyle";
import * as shelljs from 'shelljs';
import * as path from 'path';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as child from 'child_process';

export type TypeChecker = (node: AST.Nodes) => Type
export type TypeCheckError = TypeMismatchError | TypeErrorGeneric | TypeErrorUndefined | GenericError;

export type GenericError = {
    kind: 'generic',
    source: AST.Nodes,
    error: string
}

export type TypeErrorUndefined = {
    kind: 'typeUndefined',
    source: AST.Identifier
}

export interface TypeErrorGeneric {
    kind: 'typeErrorGeneric',
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

class Scope {
    parent?: Scope
    children: Scope[] = []
    declarationsByIdentifier: { [identifier: string]: AST.DeclarationNode[] } = {}
}

/**
 * With some declarations, such as functions, it is valid to have multiple declarations with the same identifier. These are distinguised
 * by their type parameters. This should probably only really be used for that purpose
 */
export function resolveMultipleDeclarationsByIdentifier(identifier: string, context: TypeCheckContext, scope: Scope): AST.DeclarationNode[] {
    if (!scope) return null;
    if (scope.declarationsByIdentifier[identifier]) return scope.declarationsByIdentifier[identifier];
    return resolveMultipleDeclarationsByIdentifier(identifier, context, scope.parent);
}

export function resolveDeclarationByIdentifier(identifier: string, context: TypeCheckContext, scope: Scope): AST.DeclarationNode {
    const all = resolveMultipleDeclarationsByIdentifier(identifier, context, scope);
    if (all && all.length > 0) return all[0];
    return null;
}

export function getDeclarationSources(declaration: AST.DeclarationNode, scope: Scope, context: TypeCheckContext): AST.DeclarationNode[] {
    if (declaration.valueExpression.type === 'expressionidentifier') {
        const identifier = declaration.valueExpression.value;
        const decs = resolveMultipleDeclarationsByIdentifier(identifier, context, scope);
        return _.flatten(decs.map(dec => getDeclarationSources(declaration, scope, context)));
    }
    return [declaration];
}

export function findMatchingFunction(identifier: string, args: Type, scope: Scope, context: ModuleTypeCheckContext, autocurry: boolean = true): AST.CallableLiteral | null {
    const decs = resolveMultipleDeclarationsByIdentifier(identifier, context.typeCheckContext, scope);
    // Some declarations could be identifiers referring to a still earlier declaration, find the source!
    const sourceDecs = _.flatten(decs.map(d => getDeclarationSources(d, scope, context.typeCheckContext))) as AST.DeclarationNode[];

    for (let i = 0; i < sourceDecs.length; i++) {
        const dec = sourceDecs[i];
        const exprType = typeCheckExpression(dec.valueExpression, context, scope);
        if (exprType.kind !== 'function') continue;

        const callable = dec.valueExpression as AST.CallableLiteral;
        const inputType = createArrayType(callable.input.map(i => i.type));

        if (checkIsAssignable(inputType, args)) {
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
    return type.kind === 'builtin' && (
        type === b.int16 ||
        type === b.int32 ||
        type === b.int8 ||
        type === b.uint16 ||
        type === b.uint32 ||
        type === b.uint8
    );
}

export function checkIsAssignable(dest: Type, source: Type): boolean {
    if (dest.kind === 'reference' || source.kind === 'reference') {
        // We can't compare two types if we don't know what they refer to. This function is
        // purely for checking the compatiblity of types
        throw new Error('Reference types should have been resolved by this point');
    }

    // Any type
    if (dest.kind === 'any' || source.kind === 'any') return true;

    if (dest.kind !== source.kind) {
        // Type of the types have to match
        return false;
    }

    if (dest.kind === 'builtin' && source.kind === 'builtin' && dest.identifier === source.identifier) {
        // These refer to the same type as far as I'm aware :O
        return true;
    }

    if (dest.kind === 'map' && source.kind === 'map') {
        // Map type
        const [mapDest, mapSource] = [dest as MapType, source as MapType];

        return _.keys(mapDest.map).every(key => {
            return mapSource.map[key] && checkIsAssignable(mapDest[key], mapSource[key]);
        });
    }

    if (dest.kind === 'array' && source.kind == 'array') {
        // Array type
        const [arrayDest, arraySource] = [dest as ArrayType, source as ArrayType];

        if (Array.isArray(arrayDest.elementType) && Array.isArray(arraySource.elementType)) {
            return (arrayDest.elementType as Type[]).every((type, index) => checkIsAssignable(type, arraySource.elementType[index]))
        }

        if (!Array.isArray(arrayDest.elementType) && !Array.isArray(arraySource.elementType)) {
            return checkIsAssignable(arrayDest.elementType as Type, arraySource.elementType as Type);
        }
    }

    if (dest.kind === 'or' && source.kind === 'or') {
        // Or type
        const [orDest, orSource] = [dest as OrType, source as OrType];
        return orDest.choices.some((type, index) => checkIsAssignable(type, orSource.choices[index]));
    }

    if (dest.kind === 'and' && source.kind === 'and') {
        // And type
        const [andDest, andSource] = [dest as AndType, source as AndType];
        return andDest.choices.every((type, index) => checkIsAssignable(type, andSource.choices[index]));
    }

    if (dest.kind === 'function' && source.kind === 'function') {
        // Function type
        const [destFunc, sourceFunc] = [dest as FunctionType, source as FunctionType];
        return checkIsAssignable(destFunc.output, sourceFunc.output) && checkIsAssignable(destFunc.input, sourceFunc.input);
    }

    return false;
}

export function genericError(error: string, source: AST.Nodes): GenericError {
    return {
        kind: 'generic',
        error,
        source
    }
}

export function createError(error: string, nodes: AST.CodeNode[] = []): TypeErrorGeneric {
    return {
        kind: 'typeErrorGeneric',
        value: error,
        nodes: nodes
    }
}

export interface TypedNode {
    node: AST.Nodes,
    type?: Type
}

export class ModuleTypeCheckContext {
    constructor(
       public module: AST.ModuleNode,
       public typeCheckContext: TypeCheckContext,
    ){}

    rootScope: Scope = new Scope()

    // We store resolved types on a module by module basis, this is so if we
    // have seperate modules with types with the same name, hopefully we handle that
    // more appropriately
    typesByIdentifier: { [identifier: string]: Type } = {}
}

export class TypeCheckContext {
    modules: ModuleTypeCheckContext[] = []
    modulesByIdentifier: () => { [identifier: string]: ModuleTypeCheckContext } = () => {
        const c = this as any;
        return _.indexBy(this.modules, module => module.module.identifier.value);
    }
    errors: TypeCheckError[] = []
    warnings: TypeCheckError[] = []
    typesByNodeId: { [nodeId: string]: {node: AST.Nodes, type?: Type} } = {}

    checkType: TypeChecker = (node) => this.typesByNodeId[node._id] ? this.typesByNodeId[node._id].type : getAnyType()
    nodeFromId = (node: AST.Nodes) => this.typesByNodeId[node._id] ? this.typesByNodeId[node._id].node : null
}

export function typeCheckDeclaration(declaration: AST.DeclarationNode, context: ModuleTypeCheckContext, scope: Scope): Type {

    const typeCheckContext = context.typeCheckContext;
    let declarationType: Type;

    if (declaration.typeExpression) {
        declarationType = declaration.typeExpression;
    }

    if (declaration.valueExpression) {
        let expressionType = typeCheckExpression(declaration.valueExpression, context, scope);
        const match = checkIsAssignable(declarationType || getAnyType(), expressionType);
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
    context.typeCheckContext.typesByNodeId[declaration._id] = {node: declaration, type: declarationType};
    const existing = resolveMultipleDeclarationsByIdentifier(declaration.identifier.value, typeCheckContext, scope);

    if (existing) {
        if (declaration.flags.has('function')) {
            // It's okay, we can have multiple under same identifier, just ensure they have different typed operands that
            // we can use to differentiate by
            scope.declarationsByIdentifier[declaration.identifier.value].push(declaration);
            const allUnique = scope.declarationsByIdentifier[declaration.identifier.value].every((declaration, i, array) => {
                return array.every((other, i2, array) => {
                    if (i2 === i) return true; // Will encounter ourselves in this list, skip that one


                    const declarationType = context.typeCheckContext.checkType(declaration);
                    const otherDeclaration = context.typeCheckContext.checkType(declarationType);
                    // Make sure types are not assignable, i.e. all are unique
                    const match = checkIsAssignable(declarationType, otherDeclaration);
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

export function typeCheckAssignment(assignment: AST.AssignmentNode, modContext: ModuleTypeCheckContext, scope: Scope): Type {

    const context = modContext.typeCheckContext;
    const declaration = resolveDeclarationByIdentifier(assignment.identifier.value, context, scope);
    if (!declaration) {
        context.errors.push(createError(`Unable to find variable ${assignment.identifier} to assign to`));
    }

    const decType = modContext.typeCheckContext.checkType(declaration) || getAnyType();
    const expressionType = typeCheckExpression(assignment.valueExpression, modContext, scope);

    const match = checkIsAssignable(decType, expressionType);
    if (!match) {
        console.error('Create our type error messages in the type match function itself?');
    }

    return decType;
}

export function resolveFunctionByIdentifier(identifier: string, match: { inputType?: Type, outputType?: Type }, context: ModuleTypeCheckContext, scope: Scope, errorSource: AST.Nodes): AST.CallableLiteral | null {
    // We assume all of these are callable literals, but they could not be, TODO: fix
    const found = resolveMultipleDeclarationsByIdentifier(identifier, context.typeCheckContext, scope);

    if (!found || found.length === 0) return null;

    const matches = found.filter(decl => {
        const functionType = typeCheckExpression(decl.valueExpression, context, scope);
        if (functionType.kind !== 'function') {
            context.typeCheckContext.errors.push(createError("Trying to call non function"));
            return false;
        }

        if (match.inputType && !checkIsAssignable(functionType.input, match.inputType)) {
            return false;
        }
        if (match.outputType && !checkIsAssignable(functionType.output, match.outputType)) {
            return false;
        }

        return true;
    });

    if (matches.length > 1) {
        context.typeCheckContext.errors.push(createError('Function call is ambiguous', [errorSource]));
        return null;
    }
    if (matches.length === 0) {
        context.typeCheckContext.errors.push(createError('Function has no matching input', [errorSource]));
        return null;
    }

    return matches[0].valueExpression as AST.CallableLiteral;
}

export function typeCheckCallExpression(expression: AST.CallExpressionNode, modContext: ModuleTypeCheckContext, scope: Scope) : Type {

    const context = modContext.typeCheckContext;
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

            return typeCheckModule(mod.module, mod.typeCheckContext).type;
        }
        else if (expression.target.value === 'npm') {

            const module = expression.input.value[0];
            return typingsFromNPM(module);
        }

        callable = resolveFunctionByIdentifier(expression.target.value, { inputType }, modContext, scope, expression);
        functionType = typeCheckExpression(callable, modContext, scope) as FunctionType;
    }
    else {
        functionType = typeCheckExpression(expression.target, modContext, scope) as FunctionType;
    }

    const checkFunction = (inputType: Type, func: FunctionType) => {
        return checkIsAssignable(func.input, inputType);
    }

    if (functionType.kind !== 'function') {
        context.errors.push(createError(`Expression is not a function`, [expression]));
        return getAnyType();
    }

    const asMethod = functionType as FunctionType;
    const inputMatches = checkIsAssignable(asMethod.input, inputType);

    if (!inputMatches) {
        context.errors.push(createError(`Input for method $0 does not match declared`, [expression.target]));
    }
    return asMethod.output;
}

export function typingsFromNPM(module: string) : Type {
    const installPath = path.join(util.getUserHome(), 'livelang');
    if (!fs.existsSync(installPath)) fs.mkdirSync(installPath);

    // First try to install the module and look for built in typings
    try {
        const result = child.execSync('npm install ' + module, {cwd: installPath});
        const packageJSON = require(path.join(installPath, 'node_modules', module, 'package.json'));
        if (packageJSON.typings) {
            return typingsFromTypescript(path.join(installPath, 'node_modules', module, packageJSON.typings));
        }
    }catch(e) {
        console.error("Error installing npm module");
        console.error(e);
    }

    // Otherwise, try get a standalone types module and use those
    try {
        const result = child.execSync('npm install @types/' + module, {cwd: installPath});
        return typingsFromTypescript(path.join(installPath, 'node_modules', '@types', module, 'index.d.ts'));
    } catch(e) {
        console.error("Error installing @types for module");
        console.error(e);
    }

    console.error('literally everything failed');
    return getAnyType();
}

export function typingsFromTypescript(filepath: string) : Type {

    const fileContents = fs.readFileSync(filepath).toString();
    const program = ts.createProgram([filepath], {types: [], rootDir: path.dirname(filepath), target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS});
    const sourceFile = program.getSourceFile(filepath);
    const typeChecker = program.getTypeChecker();

    const symbol = typeChecker.getSymbolAtLocation(sourceFile);
    if (!symbol) {
        console.log('types has no symbol... no exports?');
        return getAnyType();
    }

    function typeOfSymbol(symbol: ts.Symbol) : Type {
        if (symbol.exports) {
            return createMapType(_.mapObject(symbol.exports, typeOfSymbol), symbol.name);
        }

        // probably need to ensure the 0th declaration here is always the one we want
        const typeOf = typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.declarations[0]);
        const properties = typeChecker.getPropertiesOfType(typeOf);

        if (properties && properties.length) {
            let map = {};
            properties.forEach(prop => {
                map[prop.name] = typeOfSymbol(prop);
            });
            return createMapType(map, symbol.name);
        }

        return getAnyType();
    }

    return typeOfSymbol(symbol) || getAnyType();
}

export function typeCheckExpression(expression: AST.ExpressionType, modContext: ModuleTypeCheckContext, scope: Scope): Type {
    if (!expression) {
        return b.null;
    }

    const context = modContext.typeCheckContext;
    function getType() {

        if (expression.type === 'expressionidentifier') {

            // Strings of value false and true always resolve to type boolean
            if (expression.value === 'false' || expression.value === 'true') return b.boolean;

            const resolved = resolveDeclarationByIdentifier(expression.value, context, scope);

            if (!resolved) {
                context.errors.push({ kind: 'typeUndefined', source: expression });
                return getAnyType();
            }

            const type = typeCheckDeclaration(resolved, modContext, scope);
            if (type.kind === 'unresolved') {
                // we should wait for it to become resolved
            }
        }
        if (expression.type === 'expressionarrayLiteral') {

            const array = expression.value;
            // return array of most common parent type if possible
            const childTypes = array.map(expression => typeCheckExpression(expression, modContext, scope));

            // let allAssignable = true;
            // const sameType = childTypes.reduce((prev, curr) => {

            //     if (prev && allAssignable) {
            //         allAssignable = checkIsAssignable(prev, curr);
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
            return typeCheckCallExpression(expression, modContext, scope);
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
    modContext.typeCheckContext.typesByNodeId[expression._id] = {type, node: expression};
    return type;
}

let lastReference: string = null;

/**
 * Assumes all the built in types exist, uses them as part of this function
 */
export function resolveReferenceTypesInType(type: Type, context: ModuleTypeCheckContext) : Type {

    const recurse = type => resolveReferenceTypesInType(type, context);
    const tryResolve = identifier => {
        if (context.typesByIdentifier[identifier]) {
            return context.typesByIdentifier[identifier];
        }
        // Fallback to a built in type (otherwise will return null)
        return b[identifier] || null;
    }

    if (type.kind === 'reference') {
        const resolved = tryResolve(type.identifier);

        if (resolved) {
            if (lastReference == type.identifier) {
                console.error('Recursive reference type!');
                return getAnyType();
            }
            lastReference = type.identifier;
            return recurse(resolved);
        }
        else {
            console.error('Unresolved type: ' + type);
            return getAnyType();
        }
    }
    else if (type.kind === 'array') {
        if (Array.isArray(type.elementType)) {
            const mapped = type.elementType.map(t => recurse(type));
            return createArrayType(mapped as Type[], type.identifier)
        }
        else {
            const resolved = recurse(type.elementType);
            return createArrayType(resolved as Type, type.identifier)
        }
    }
    else if (type.kind === 'function') {
        const inn = recurse(type.input);
        const out = recurse(type.output);
        return createCallableType(inn as Type, out as Type, type.identifier);
    }
    else if (type.kind === 'map') {
        return createMapType(_.mapObject(type.map, val => recurse(val)), type.identifier);
    }
    else if (type.kind === 'builtin' || type.kind === 'any') {
        return type;
    }
    else {
        // Unsupported type, assume it's okay
        console.warn("Unsupported type, is this okay?");
        return type;
    }
}

interface ModuleTypeCheckResult {
    /**
     * The context that was used for the type checking. Contains various related information
     */
    context: ModuleTypeCheckContext
    /**
     * A type that can be used to access exported members inside the module
     */
    type: MapType
}

export function mapTypeFromModuleContext(context: ModuleTypeCheckContext) : MapType {

    const getType = (node: AST.Nodes) => context.typeCheckContext.typesByNodeId[node._id].type;
    const mapped = _.mapObject(context.rootScope.declarationsByIdentifier, val => {
      return createOrType(val.map(v => getType(v)));
    });

    return createMapType(mapped);
}

export function typeCheckModule(module: AST.ModuleNode, context?: TypeCheckContext): ModuleTypeCheckResult {
    if (!context) {
        context = new TypeCheckContext();
    }

    // if we've already checked this module, return our stored context for it
    if (context.modulesByIdentifier()[module.identifier.value]) {
        const moduleContext = context.modulesByIdentifier()[module.identifier.value];
        return {
            context: context.modulesByIdentifier()[module.identifier.value],
            type: mapTypeFromModuleContext(moduleContext)
        };
    }

    const moduleContext = new ModuleTypeCheckContext(module, context);
    context.modules.push(moduleContext);

    function processChild(child: AST.ModuleChild) {
        if (child.type.startsWith('expression')) {
            typeCheckExpression(child as AST.ExpressionType, moduleContext, moduleContext.rootScope);
        }
        else if (child.type === 'declaration') {
            typeCheckDeclaration(child, moduleContext, moduleContext.rootScope);
        }
        else if (child.type === 'assignment') {
            typeCheckAssignment(child, moduleContext, moduleContext.rootScope);
        }
    }

    const libraryDeclarations: AST.DeclarationNode[] = _.flatten([
        [].concat(numbers.declarations, arrays.declarations)
    ]);
    libraryDeclarations.forEach(processChild);

    function resolveAllReferenceTypes() {
        // Gather all the types first
        AST.eachChild(module, node => {
            if (node.type === 'type' && node.kind !== 'reference' && node.identifier) {
                moduleContext.typesByIdentifier[node.identifier] = node;
            }
        });

        // Then make sure all their own types are resolved
        _.mapObject(moduleContext.typesByIdentifier, val => resolveReferenceTypesInType(val, moduleContext))

        // Thennnnnnn resolve all reference types in the code
        AST.mapChildren(module, child => {
            if (child.type === 'type' && child.kind === 'reference') {
                return resolveReferenceTypesInType(child, moduleContext);
            }
            return child;
        });

        // We do all of these as separate steps because we need ALL the named types to exist before
        // we go resolving references, we can't try and resolve references as we find them because.. well
        // the named version it references might not exist yet
    }
    resolveAllReferenceTypes();

    // TODO: Prepopulate all declarations by identifier
    module.children.forEach(child => {
        // Process init blocks first
        if (child.type === 'scope' && child.flags.has('init')) {
            child.children.forEach(processChild);
        }
    });
    module.children.forEach(processChild);

    return {
        context: moduleContext,
        type: mapTypeFromModuleContext(moduleContext)
    };
}

export function createChecker(modules: AST.ModuleNode[]) : {checker: TypeChecker, context: TypeCheckContext} {

    const typeCheckContext = new TypeCheckContext();
    const results = modules.map(module => typeCheckModule(module, typeCheckContext));

    return {
        checker: node => typeCheckContext.checkType(node),
        context: typeCheckContext
    }
}