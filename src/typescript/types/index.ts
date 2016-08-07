interface BuiltInType<RawType> {
    typeIdentifier: string
    rawValue: RawType
    defaultValue: RawType
}

type BuiltInTypeUpdater<RawType> = (value: RawType) => RawType
type TypeIdentifier = string; 

export const BuiltInTypes = {

    any: 'any',
    
    string: 'string',
    
    int32: 'int32',
    int16: 'int16',
    int8: 'int8',

    uint32: 'uint32',
    uint16: 'uint16',
    uint8: 'uint8',

    boolean: 'boolean'
}