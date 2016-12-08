import * as Types from '../../types/index';
import * as AST from '../../ast/index';
import {BuiltInTypes as builtIn} from '../../types/builtin';
import * as _ from 'underscore';

export type RunTimeFunction = (args: RunTimeRepresentation<any>[]) => RunTimeRepresentation<any>;
export interface RunTimeRepresentation<T extends Types.Type> {
    rawValue: any,
    stringValue(): string,
    clone(): this

    /**
     * Optional for the time being as not sure if absolutely necessary, especially when we start getting into 
     * array and map types. Why don't we just use our type check context? Is speed really an issue?
     */
    type?: T
}

export const callableRep = (instructions: AST.ModuleChild[] | Function, identifiers: string[]) => {
    let rep = {
        rawValue: instructions,
        stringValue: () => rep.rawValue.toString(),
        identifiers: [],
        clone: () => rep
    }
    return rep;
}

export const booleanRep = (val?: boolean) => {
    let rep = {
        rawValue: val || false,
        stringValue : () => rep.rawValue.toString(),
        flip: () => rep.rawValue = !rep.rawValue,
        set(val: boolean) {rep.rawValue = val},
        type: builtIn.boolean,
        clone: () => rep
    }
    return rep;    
}

export const float32Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.float32,
        clone: () => rep
    }
    return rep;    
} 

export const float64Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.float64,
        clone: () => _.extend({}, rep)
    }
    return rep;    
} 

export const int8Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.int8,
        clone: () => _.extend({}, rep)
    }
    return rep;    
} 

export const int16Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.int16,
        clone: () => _.extend({}, rep)
    }
    return rep;    
} 

export const int32Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.int32,
        clone: () => _.extend({}, rep)
    }
    return rep;    
}

export const uint8Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.uint8,
        clone: () => _.extend({}, rep)
    }
    return rep;    
} 

export const uint16Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.uint16,
        clone: () => _.extend({}, rep)
    }
    return rep;    
} 

export const uint32Rep = (val?: number) => {
    let rep = {
        rawValue: val || 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.uint32,
        clone: () => _.extend({}, rep)
    }
    return rep;    
} 

export const arrayRep = () => {
    let rep = {
        rawValue: [],
        stringValue : () => '[' + rep.rawValue.map(v => v.rawValue).join(', ') + ']',
        set(val: Array<any>) {rep.rawValue = val},
        clone: () => _.extend({}, rep)
    }
    return rep;    
}

export const mapRep = () => {
    let rep = {
        rawValue: {},
        stringValue : () => JSON.stringify(rep.rawValue),
        set(key: string, value: any) {rep.rawValue[key] = value},
        clone: () => _.extend({}, rep)
    }
    return rep;    
}

export const stringRep = (val?: string) => {
    let rep = {
        rawValue: val || '',
        stringValue : () => rep.rawValue.toString(),
        set(val: string) {rep.rawValue = val},
        clone: () => _.extend({}, rep)
    }
    return rep;
}