import * as AST from '../ast/index';
import * as _ from 'underscore';
import * as util from '../util';
import * as numbers from '../interpreter/lib/number';
import * as string from '../interpreter/lib/string';
import * as boolean from '../interpreter/lib/boolean';

export interface TypeBase {
   
}

export type Type = TypeBase & (AndType | OrType | FunctionType | MapType | ArrayType | IdentifierType | AnyType | GenericType);

export interface AnyType extends TypeBase {
    type: 'any'
}

export interface GenericType extends TypeBase {
    type: 'generic',
    match: Type
}

export interface AndType extends TypeBase {
    type: 'and',
    choices: Type[]
}

export interface OrType extends TypeBase {
    type: 'or',
    choices: Type[]
}

export interface IdentifierType extends TypeBase {
    type: 'identifier',
    identifier: string
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

export interface FunctionType extends TypeBase {
    type: 'function'
    input: Type
    output: Type
}

export function getAnyType() : Type {
    return {
        identifier: 'any',
        type: 'any'
    }
}

export const genericArray = createArrayType(getGenericType());
export function getGenericType() : GenericType {
    return {
        identifier: 'generic',
        type: 'generic',
        match: getAnyType()
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

export function createValueType(identifier: string) : IdentifierType {
    return {
        identifier: identifier,
        type: 'identifier'
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

export function createCallableType<I extends Type, O extends Type>(input: I, output: O, identifier?: string) : FunctionType {
    return {
        identifier: identifier,
        type: 'function',
        input: input,
        output: output
    };
}

export function typeToString(type: Type) : string {

    if (type.type === 'function') {
        const func = type as FunctionType;
        return `(${typeToString(func.input)}) -> ${typeToString(func.output)}` 
    }
    else if (type.type === 'or') {
        const orType = type as OrType;
        return orType.choices.map(typeToString).join(' | ');
    }
    else if (type.type === 'and') {
        const andType = type as AndType;
        return andType.choices.map(typeToString).join(' & ');
    }
    else if (type.type === 'array') {
        const array = type as ArrayType;

        if (Array.isArray(array.elementType)) {
            return `[${array.elementType.map(typeToString).join(', ')}]`;
        }
        else {
            return `[${array.elementType}]`;
        }
    }
    else if (type.type === 'map') {
        
    }
    
    return type.identifier || type.type || 'unknown';
}