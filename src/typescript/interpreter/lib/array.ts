import * as AST from '../../ast/index';
import * as _ from 'underscore';
import * as util from '../../util';
import * as reps from '../runtime/reps';
import * as types from '../../types/index';
import {BuiltInTypes as BuiltIn} from '../../types/BuiltIn';
import {makeCallableDeclaration} from './util';
import * as immutable from 'immutable';

export const slice = makeCallableDeclaration('slice', [types.genericArray, BuiltIn.int32, BuiltIn.int32], types.genericArray, args => {
    return args[0].rawValue.slice(args[1].rawValue, args[2].rawValue);
});

export const get = makeCallableDeclaration('get', [types.genericArray, BuiltIn.int32], types.genericArray, args => {
    return args[0].rawValue.get(args[1].rawValue);
});

export const first = makeCallableDeclaration('first', [types.genericArray], types.genericArray, args => {
    return args[0].rawValue.get(0);
});

export const last = makeCallableDeclaration('last', [types.genericArray], types.genericArray, args => {
    return args[0].rawValue.get(args[0].rawValue.size - 1);
});

export const concat = makeCallableDeclaration('last', [types.genericArray, types.createArrayType(types.genericArray)], types.genericArray, args => {
    return args[0].rawValue.concat(args[1].rawValue);
});

export const declarations = [
    slice,
    get,
    first,
    last,
    concat
];