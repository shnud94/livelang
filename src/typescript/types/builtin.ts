import {createBuiltInType, getAnyType} from './index';

export const BuiltInTypes = {
    any: getAnyType(),
    
    string: createBuiltInType('string'),
    
    int32: createBuiltInType('int32'),
    int16: createBuiltInType('int16'),
    int8: createBuiltInType('int8'),

    uint32: createBuiltInType('uint32'),
    uint16: createBuiltInType('uint16'),
    uint8: createBuiltInType('uint8'),

    float32: createBuiltInType('float32'),
    float64: createBuiltInType('float64'),

    boolean: createBuiltInType('boolean'),

    null: createBuiltInType('null')
}