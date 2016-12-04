import * as AST from '../ast/index';
import * as _ from 'underscore';
import * as util from '../util';
import * as numbers from '../interpreter/lib/number';
import * as string from '../interpreter/lib/string';
import * as boolean from '../interpreter/lib/boolean';


export interface TypeBase extends AST.CodeNode {
    type: 'type'

    /**
     * Every type may or may not have an identifier. Anonymous types defined inline can't have identifiers for example,
     * but doing something similar to a typealias/declaring a type requires an identifier
     */
   identifier?: string
}

export type Type = AndType | OrType | FunctionType | MapType | ArrayType | ReferenceType | AnyType | GenericType | UnresolvedType;

/**
 * Matches anything - can only really be used in dynamic runtimes
 */
export interface AnyType extends TypeBase {
    kind: 'any'
}

/**
 * A place holder for any type that meets certain criteria
 */
export interface GenericType extends TypeBase {
    kind: 'generic',
    match: Type
}

/**
 * A combination of two types... hmm...
 */
export interface AndType extends TypeBase {
    kind: 'and',
    choices: Type[]
}

/**
 * A choice between multiple, possibly completely disparate types
 */
export interface OrType extends TypeBase {
    kind: 'or',
    choices: Type[]
}

/**
 * Refer to another type by name
 */
export interface ReferenceType extends TypeBase {
    kind: 'reference',
    identifier: string
}

/**
 * Like a classic object/interface
 */
export interface MapType extends TypeBase {
    kind: 'map'
    map: {[key: string] : Type}
}

export interface UnresolvedType extends TypeBase {
    kind: 'unresolved',
    dependants: any[]
}

export interface ArrayType extends TypeBase {
    kind: 'array'
    /**
     * One type says that the array is all of the same type,
     * but an array of types specifies a fixed length array of
     * particular types, i.e. tuples/function arguments
     */
    elementType: Type | Type[]
}

export interface FunctionType extends TypeBase {
    kind: 'function'
    input: Type
    output: Type
}

export function getAnyType() : Type {
    return {
        type: 'type',
        identifier: 'any',
        kind: 'any'
    }
}

export const genericArray = createArrayType(getGenericType());
export function getGenericType() : GenericType {
    return {
        type: 'type',
        kind: 'generic',
        match: getAnyType()
    }
}

export function createMapType(map: {[key: string] : Type}, identifier?: string) : MapType {
    return {
        type: 'type',
        identifier: identifier,
        kind: 'map',
        map: map
    };
}

export function createArrayType(type: Type | Type[], identifier?: string) : ArrayType {
    return {
        type: 'type',
        identifier: identifier,
        kind: 'array',
        elementType: type
    };
}

export function createReferenceType(identifier: string) : ReferenceType {
    return {
        type: 'type',
        identifier: identifier,
        kind: 'reference'
    };
}

export function createAndType(choices: Type[], identifier?: string) : AndType {
    return {
        type: 'type',
        identifier: identifier,
        kind: 'and',
        choices: choices
    };
}

export function createOrType(choices: Type[], identifier?: string) : OrType {
    return {
        type: 'type',
        identifier: identifier,
        kind: 'or',
        choices: choices
    };
}

export function createCallableType<I extends Type, O extends Type>(input: I, output: O, identifier?: string) : FunctionType {
    return {
        type: 'type',
        identifier: identifier,
        kind: 'function',
        input: input,
        output: output
    };
}

export function typeToString(type: Type) : string {

    if (type.kind === 'function') {
        const func = type as FunctionType;
        return `(${typeToString(func.input)}) -> ${typeToString(func.output)}` 
    }
    else if (type.kind === 'or') {
        const orType = type as OrType;
        return orType.choices.map(typeToString).join(' | ');
    }
    else if (type.kind === 'and') {
        const andType = type as AndType;
        return andType.choices.map(typeToString).join(' & ');
    }
    else if (type.kind === 'array') {
        const array = type as ArrayType;

        if (Array.isArray(array.elementType)) {
            return `[${array.elementType.map(typeToString).join(', ')}]`;
        }
        else {
            return `[${array.elementType}]`;
        }
    }
    else if (type.kind === 'map') {
        
    }
    
    return type.identifier || type.kind || 'unknown';
}