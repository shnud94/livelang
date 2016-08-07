import * as program from '../program';
import {AST, Helpers, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import {EventSource} from '../util/events';

export interface ComponentDescription {
    /**
     * An id the dom keeps for each component of a node
     */
    id?: string
    text?: string
    immutable?: boolean
    children?: ComponentController[]
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

export interface ComponentControllerEvents {
    /**
     * If id passed, only that component from the node has changed and needs re-rendering
     */
    nodeChanged: EventSource<{id?: string}>,
    nodeChildInserted: EventSource<{index: number}>,
    nodeChildRemoved: EventSource<{index: number}>
}
export interface ComponentController {

    events: ComponentControllerEvents,
    
    handleComponentChange(value: string, component?: ComponentDescription) : ComponentChangeResponse
    handleNewInput(value: string, prev?: ComponentDescription) : ComponentChangeResponse
    
    components(): ComponentDescription[]
}

export const createBaseComponentControllerEvents = () : ComponentControllerEvents => {
    return {
        nodeChanged: new EventSource<{id?: string}>(),
        nodeChildInserted: new EventSource<{index: number}>(),
        nodeChildRemoved: new EventSource<{index: number}>()
    }
}

export type ControllerProvider = (node: AST.CodeNode) => ComponentController;
interface DOMData {
    representedNode?: AST.CodeNode
    componentController?: ComponentController
    componentDescription?: ComponentDescription
}

export const mountProgramView = (program: Program, dom: HTMLElement, controllerForNode: ControllerProvider) => {

    const container = $('<div>').addClass('code').appendTo(dom);
    const renderNode = (node: AST.CodeNode, dom: HTMLElement) => {

        const controller = controllerForNode(node);
        const processDescription = (desc: ComponentDescription) => {

            if (!desc.id) {
                // Set id to initial text if no id set
                desc.id = desc.text;
            }

            if (desc.text) {
                $('<span>')
                    .addClass('codeNode')
                    .attr('data-nodeId', node._id)
                    .attr('data-componentId', desc.id)
                    .attr('contentEditable', 'true')
                    .data({
                        representedNode: node,
                        componentDescription: desc,
                        componentController: controller
                    } as DOMData)
                    .text(desc.text).appendTo(dom);
            }
            else if (desc.children) {
                desc.children.forEach(processDescription);
            }
        };
        
        const onChanged = (id?: string) => {
            controller.components().forEach(processDescription);
        };
        controller.events.nodeChanged.listen(onChanged);
        onChanged();
    };

    renderNode(program.data, container[0]);
    const handleArrow = (event: KeyboardEvent, direction: string, element: HTMLElement, position: number, fraction: number) => {

        if (direction === 'left' || direction === 'right') {
            let dirNum = direction === 'left' ? -1 : 1;

            if (fraction === 0 && dirNum === -1 && $(element).prev()[0]) {
                
                event.preventDefault();
                $(element).prev().focus();
                util.setCaretFraction($(element).prev()[0] as HTMLElement, 1);
            }
            else if (fraction === 1 && dirNum === 1 && $(element).next()[0]) {
                
                event.preventDefault();
                $(element).next().focus();
                util.setCaretFraction($(element).next()[0] as HTMLElement, 0);
            }
        }
        else if (direction === 'up' || direction === 'down') {
            
            event.preventDefault();
            let dirNum = direction === 'down' ? 1 : -1;

            const searchForVerticalSibling = (origin: HTMLElement, direction: number) : {hit?: HTMLElement, xFraction: number} => {
                const x = util.getCaretOffset(origin).left;                    
                
                const findHitEl = (origin: HTMLElement, el: HTMLElement, runCount = 0) : {hit?: HTMLElement, xFraction: number} => {

                    if (!el) return null;
                    const elLeft = $(el).offset().left,
                        elWidth = $(el).outerWidth();
                    
                    if (el !== origin) {

                        let isHit = false;

                        if (dirNum < 0) {
                            isHit = x < (elLeft + elWidth);
                        }
                        else {
                            isHit = x > elLeft;
                        }
                        
                        if (isHit) {
                            return {
                                hit: el,
                                xFraction: Math.min(1, Math.max(0, (x - elLeft) / elWidth))
                            };
                        }
                    }

                    if (runCount < 30) {
                        return findHitEl(
                            origin, 
                            $(el)[direction < 0 ? 'prev' : 'next']('.codeNode')[0] as HTMLElement, 
                            runCount + 1
                        );
                    }

                    return null;
                };

                return findHitEl(origin, origin);                
            }
            
            const sibling = searchForVerticalSibling(element, dirNum);
            if (sibling) {
                $(sibling.hit).focus();
                util.setCaretFraction(sibling.hit, sibling.xFraction);
            }
        }
    };

    $(dom).on({
        'keydown': (event: KeyboardEvent) => {

            const code = event.keyCode;
            const focused = event.target as HTMLElement;
            const pos = util.getCaretPosition(focused);
            const fraction = util.getCaretFraction(focused);

            if (code === 13 || code === 32) {

                if ($(focused).hasClass('-new-input')) {
                    return;
                }
                // 13 - return
                // 32 - space bar
                event.preventDefault();
                
                if (fraction === 1 || fraction === 0) {
                    const newSpan = $(code === 13 ? '<div>' : '<span>').attr('contentEditable', 'true').addClass('-new-input');

                    if (fraction === 1) {
                        newSpan.insertAfter(focused);
                    }
                    else if (fraction === 0) {
                        newSpan.insertBefore(focused);
                    }

                    newSpan.focus();
                }
                return;
            }

            if (code >= 37 && code <= 40) {
                if (code === 37) {
                    handleArrow(event, 'left', focused, pos, fraction);
                }
                else if (code === 39) {
                    handleArrow(event, 'right', focused, pos, fraction);
                }
                else if (code === 38) {
                    handleArrow(event, 'up', focused, pos, fraction);
                }
                else if (code === 40) {
                    handleArrow(event, 'down', focused, pos, fraction);
                }
                return;
            }            
        },

        'keyup': (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            const data = $(target).data() as DOMData;

            if (/^[a-zA-Z0-9]+/.test(event.key)) {

                if ($(target).hasClass('-new-input')) {
                    data.componentController.handleNewInput(target.innerText, ($(target).prev(':not(.-new-input)').data() as DOMData).componentDescription)
                }
                else if (data.componentController && data.componentDescription) {

                    const response = data.componentController.handleComponentChange(target.innerText, data.componentDescription);
                    if (response.errors.length > 0) {
                        $(target).addClass('-has-errors');
                    }
                    else {
                        $(target).removeClass('-has-errors');
                    }
                    if (response.completions) {
                        console.log(response.completions);
                    }                    
                }
            }
        }
    });
}