import * as AST from '../../ast/index';
import * as _ from 'underscore';
import * as util from '../../util';
import * as reps from '../runtime/reps';
import * as types from '../../types/index';
import {BuiltInTypes as BuiltIn} from '../../types/BuiltIn';
import {makeCallableDeclaration} from './util';

export const declarations = [
    makeCallableDeclaration('*', [BuiltIn.int32, BuiltIn.int32], BuiltIn.int32, args => reps.int32Rep(args[0].rawValue * args[1].rawValue)),
    makeCallableDeclaration('/', [BuiltIn.int32, BuiltIn.int32], BuiltIn.int32, args => reps.int32Rep(args[0].rawValue / args[1].rawValue)),
    makeCallableDeclaration('+', [BuiltIn.int32, BuiltIn.int32], BuiltIn.int32, args => reps.int32Rep(args[0].rawValue + args[1].rawValue)),
    makeCallableDeclaration('-', [BuiltIn.int32, BuiltIn.int32], BuiltIn.int32, args => reps.int32Rep(args[0].rawValue - args[1].rawValue)),
]