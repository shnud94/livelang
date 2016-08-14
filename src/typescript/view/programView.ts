import * as program from '../program';
import {AST, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import {EventSource} from '../util/events';
import * as Frontend from '../frontend/index';
import * as js from '../frontend/javascriptStyle';
import {NodeEvents, NodeTextController, ComponentDescription} from './index';
import {basicController} from './nodeController';
import * as _ from 'underscore';

export type ControllerProvider = (node: AST.CodeNode) => NodeTextController;
export interface DOMData {
    representedNode?: AST.CodeNode
    componentController?: NodeTextController
    index: number
}

export const mountProgramView = (program: Program, dom: HTMLElement) => {

    const container = $('<div>').addClass('code').appendTo(dom);
    const rootController = basicController(program.data);
    rootController.render(container[0]);

    const layoutRange = (start: HTMLElement, end: HTMLElement) => {

        let tabLevel = 0;

        const getElementsInRange = (start: HTMLElement, end: HTMLElement) => {
            if (start === end) {
                return [start];
            }

            const nodes = [start];
            let next = start;
            do {
                next = $(next).next()[0];
                if (next) {
                    nodes.push(next);  
                }             
            } while (next && next !== end);

            return nodes;
        }
        
        getElementsInRange(start, end).forEach(el => {
            const getDisplayOptions = (el) => {
                const data = $(el).data() as DOMData;
                if (data.componentController && data.componentController.description && data.componentController.description.displayOptions) {
                    return data.componentController.description.displayOptions()[data.index];
                } 
            } 

            const displayOptions = getDisplayOptions(el);
            
            if (displayOptions) {
                // Do stuff
            }
            if ($(el).text()) {
                $(el).css({marginRight: '0.5em'});
            }

            const $before = $(el).prev(':not(._layout)');
            if ($before.length == 0) {
                return;
            }

            const beforeDisplayOptions = getDisplayOptions($before[0]);
            if (beforeDisplayOptions) {
                // Tab level calculation needs to happen before line break
                if (typeof(beforeDisplayOptions.tabsNextLine) === 'number') {
                    tabLevel += beforeDisplayOptions.tabsNextLine;
                }
                if (beforeDisplayOptions.breaksLine) {
                    $('<br />').insertBefore(el).addClass('_layout');
                    $(el).css({'marginLeft': `${tabLevel * 2}em`});
                }                 
            }
        });
    };
    layoutRange(container.children()[0] as HTMLElement, container.children().last()[0] as HTMLElement);

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

    const keyup = _.debounce((event: KeyboardEvent) => {
        const target = event.target as HTMLElement;
        const data = $(target).data() as DOMData;

        if (/^[a-zA-Z0-9]+/.test(event.key)) {

            if (data.componentController) {
                const response = data.componentController.handleComponentChange(data.index);
                if (response.errors.length > 0) {
                    console.log(response.errors);
                    $(target).addClass('-has-errors');
                }
                else {
                    $(target).removeClass('-has-errors');
                }
                if (response.completions.length > 0) {
                    console.log(response.completions);
                }                    
            }
        }
    }, 200);

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

        'keyup': keyup,
        'change': keyup
    });
}