import {createValueType} from './index';

export const BuiltInTypes = {
    any: createValueType('any'),
    
    string: createValueType('string'),
    
    int32: createValueType('int32'),
    int16: createValueType('int16'),
    int8: createValueType('int8'),

    uint32: createValueType('uint32'),
    uint16: createValueType('uint16'),
    uint8: createValueType('uint8'),

    float32: createValueType('float32'),
    float64: createValueType('float64'),

    boolean: createValueType('boolean'),

    null: createValueType('null')
}