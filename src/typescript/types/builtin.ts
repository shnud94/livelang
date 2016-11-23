import {createReferenceType, getAnyType} from './index';

export const BuiltInTypes = {
    any: getAnyType(),
    
    string: createReferenceType('string'),
    
    int32: createReferenceType('int32'),
    int16: createReferenceType('int16'),
    int8: createReferenceType('int8'),

    uint32: createReferenceType('uint32'),
    uint16: createReferenceType('uint16'),
    uint8: createReferenceType('uint8'),

    float32: createReferenceType('float32'),
    float64: createReferenceType('float64'),

    boolean: createReferenceType('boolean'),

    null: createReferenceType('null')
}