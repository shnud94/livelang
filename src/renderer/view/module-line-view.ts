import * as AST from '../ast/index';
import * as ASTUtil from '../ast/util';
import * as LineView from './lineView';
import * as index from './index';
import * as parser from '../parser/custom';
import * as textDesc from '../frontend/javascriptStyle';
import * as interpreter from '../interpreter/index';
import * as checker from '../types/checker';
import * as types from '../types/index';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as project from '../project/project';

interface ProgramLineViewOptions {
    onSuccessfulChange?()
}

export function create(moduleHandle: project.FileHandle, container: HTMLElement, options: ProgramLineViewOptions) {
    $(container).empty();

    return {
        lineView: null
    }
}