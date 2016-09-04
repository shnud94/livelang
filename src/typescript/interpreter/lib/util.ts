import * as AST from '../../ast/index';
import * as _ from 'underscore';
import * as util from '../../util';
import * as reps from '../runtime/reps';
import * as types from '../../types/index';
import {BuiltInTypes} from '../../types/builtin';

export function makeCallableDeclaration(identifier: string, argTypes: types.Type[], returnType: types.Type, impl: reps.RunTimeFunction) : AST.DeclarationNode {
    return {
        type: 'declaration',
        valueExpression: makeCallable(argTypes, returnType, impl),
        _parent: null,
        flags: new Set<'function'>(['function']),
        identifier: AST.createIdentifier(identifier),
        typeExpression: null
    }
};

export function makeCallable(argTypes: types.Type[], returnType: types.Type, impl: reps.RunTimeFunction) : AST.CallableLiteral {
    return {
        type: 'expressioncallableLiteral',
        input: argTypes.map((argType, index) => ({
            type: AST.createIdentifier(argType.identifier),
            identifier: '$' + index
        })),
        output: AST.createIdentifier(returnType.identifier),
        _runtime: {
            impl: impl
        },
        body: null,
        _parent: null
    }
};