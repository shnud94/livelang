import * as program from '../program';
import {AST, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import {EventSource} from '../util/events';
import * as Frontend from '../frontend/index';
import {NodeTextDescription, TextComponent} from '../frontend/index';
import {TypeCheckContext} from '../types/index';
import * as js from '../frontend/javascriptStyle';

export type ComponentDescription = string | NodeTextController;

export interface RenderContext {
    head?: HTMLElement,
    parent: HTMLElement,
    typeCheckContext?: TypeCheckContext
}
export interface ComponentCompletion {

    completionText: string,
    onComplete: () => void
}
export interface ComponentChangeResponse {

    /**
     * A list of explanations as to why the modification is erroneous
     */
    errors: string[],

    /**
     * If true, changes were able to be made to the source
     */
    success: boolean

    /**
     * In order with best completion first
     */
    completions: ComponentCompletion[]
}

export interface NodeEvents {
    /**
     * If id passed, only that component from the node has changed and needs re-rendering
     */
    nodeChanged: EventSource<{id?: string}>,
    nodeChildInserted: EventSource<{index: number}>,
    nodeChildRemoved: EventSource<{index: number}>
}
export interface NodeTextController {

    node: AST.CodeNode,
    description: NodeTextDescription<any>
    events: NodeEvents,
    
    handleChildComponentChange(indexes: number[], newValue: TextComponent) : ComponentChangeResponse
    handleComponentChange(newValue: TextComponent) : ComponentChangeResponse

    parentController?: NodeTextController
    render: (context: RenderContext) => void,

    indexInParent?: number,
    indexInArray?: number,

    firstNode?: HTMLElement,
    lastNode?: HTMLElement, 
}
