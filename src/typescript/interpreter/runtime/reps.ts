import * as Types from '../../types/index';
import * as AST from '../../ast/index';
const builtIn = Types.BuiltInTypes;

export interface RunTimeRepresentation<T extends Types.Type> {
    rawValue: any,
    stringValue(): string,
    
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
        identifiers: []
    }
    return rep;
}

export const booleanRep = () => {
    let rep = {
        rawValue: false,
        stringValue : () => rep.rawValue.toString(),
        flip: () => rep.rawValue = !rep.rawValue,
        set(val: boolean) {rep.rawValue = val},
        type: builtIn.boolean
    }
    return rep;    
}

export const float16Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.float16
    }
    return rep;    
}

export const float32Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.float32
    }
    return rep;    
} 

export const float64Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.float64
    }
    return rep;    
} 

export const int8Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.int8
    }
    return rep;    
} 

export const int16Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.int16
    }
    return rep;    
} 

export const int32Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.int32
    }
    return rep;    
}

export const uint8Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.uint8
    }
    return rep;    
} 

export const uint16Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.uint16
    }
    return rep;    
} 

export const uint32Rep = () => {
    let rep = {
        rawValue: 0,
        stringValue : () => rep.rawValue.toString(),
        set(val: number) {rep.rawValue = val},
        type: builtIn.uint32
    }
    return rep;    
} 

export const arrayRep = () => {
    let rep = {
        rawValue: [],
        stringValue : () => rep.rawValue.toString(),
        set(val: Array<any>) {rep.rawValue = val}
    }
    return rep;    
}

export const stringRep = () => {
    let rep = {
        rawValue: '',
        stringValue : () => rep.rawValue.toString(),
        set(val: string) {rep.rawValue = val}
    }
    return rep;    
}