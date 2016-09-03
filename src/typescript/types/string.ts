import * as Types from './index';
import * as typeUtil from './util';
import * as reps from '../interpreter/runtime/reps';
const BuiltIn = Types.BuiltInTypes;

export const init = typeUtil.createCallableRuntime('new', BuiltIn.null, BuiltIn.string, input => {
    return reps.stringRep();
});

export const substr = typeUtil.createCallableRuntime('substr', BuiltIn.string, BuiltIn.string, input => {
    return reps.stringRep();
});

export const reverse = typeUtil.createCallableRuntime('substr', BuiltIn.string, BuiltIn.string, input => {
    return reps.stringRep();
});

export const length = typeUtil.createCallableRuntime('length', BuiltIn.string, BuiltIn.string, input => {
    return reps.stringRep();
});

export const lowercased = typeUtil.createCallableRuntime('lowercased', BuiltIn.string, BuiltIn.string, input => {
    return reps.stringRep();
});

export const uppercased = typeUtil.createCallableRuntime('uppercased', BuiltIn.string, BuiltIn.string, input => {
    return reps.stringRep();
});