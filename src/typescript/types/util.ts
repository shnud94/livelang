import * as Types from './index';

interface RunTimeFunction<I, O> extends Types.FunctionType<I, O> {
    impl: (input: any) => any
}

export function createCallableRuntime<I extends Types.Type, O extends Types.Type>(identifier: string, input: I, output: O, impl: (input: any) => any) : RunTimeFunction<I, O> {
    const type = Types.createCallableType(input, output, identifier) as RunTimeFunction<I, O>;
    type.impl = impl;
    return type;    
}