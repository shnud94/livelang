import * as program from '../program';
import {AST, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import {EventSource} from '../util/events';
import * as Frontend from '../frontend/index';
import * as js from '../frontend/javascriptStyle';
import {NodeEvents, NodeTextController, ComponentDescription, ComponentChangeResponse} from './index';
import {basicController} from './nodeController';
import * as parser from '../parser/custom';
import * as _ from 'underscore';
import {Result} from '../util';

export type ControllerProvider = (node: AST.CodeNode) => NodeTextController;
export interface DOMData {
    representedNode?: AST.CodeNode
    componentController?: NodeTextController
    index: number
}

export const getDOMData = (element: JQuery | HTMLElement) : DOMData => {
    return $(element).data() as DOMData;
}

export const mountProgramView = (program: Program, dom: HTMLElement) => {

    const container = $('<div>').addClass('code').appendTo(dom);
    const rootController = basicController(program.data);

    const render = () => {
        $(container).empty();
        rootController.render(container[0]);
        layoutRange(container.children()[0] as HTMLElement, container.children().last()[0] as HTMLElement);
    };
    render();    

    function layoutRange(start: HTMLElement, end: HTMLElement) {

        let tabLevel = 0;
        util.getElementsInRange(start, end).forEach(el => {
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
            $(el).html($(el).html().replace(/ /g, '&nbsp;'));

            const content = $(el).html();
            if (content.indexOf('\n') >= 0) {
                $('<br />').insertAfter(el).addClass('_layout');
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
                    // $(el).css({'marginLeft': `${tabLevel * 2}em`});
                }                 
            }
        });
    };

    function handleArrow(event: KeyboardEvent, direction: string, element: HTMLElement, position: number, fraction: number) {

        if (direction === 'left' || direction === 'right') {
            let dirNum = direction === 'left' ? -1 : 1;

            if (fraction === 0 && dirNum === -1) {
                const prev = $(util.firstPrev($(element), $el => $el.hasClass('node') && $el.text().length > 0));
                if (prev[0]) {
                    prev.focus();
                    event.preventDefault();
                    util.setCaretPosition(prev[0] as HTMLElement, $(prev).text().length - 1);
                }
            }
            else if (fraction === 1 && dirNum === 1) {
                const next = $(util.firstNext($(element), $el => $el.hasClass('node') && $el.text().length > 0));
                if (next[0]) {
                    next.focus();
                    event.preventDefault();
                    util.setCaretPosition(next[0] as HTMLElement, 1);
                }             
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
        const $target = $(event.target);
        const data = $target.data() as DOMData;
        const value = $target.text();

        const results: Result<any>[] = [];
        let controller = data.componentController;
        const indexes = [data.index];
        
        while (controller) {

            const index = indexes[0];
            const specs = controller.description.getTextSpecs();
            const parseResult = parser.parseSpec(specs[index], value);
            results.push(parseResult);

            if (parseResult.result) {
                const changeResult = controller.handleChildComponentChange(indexes, parseResult.result);                    
                if (changeResult.success) {
                    render();
                    return;
                }
            }      

            const controllerNodeRange = getControllerNodeRange(event.target as HTMLElement, controller);
            const textInRange = util.textInNodeRange(controllerNodeRange[0], controllerNodeRange.last());
            const wholeParseResult = parser.parseSpec(controller.description, textInRange);
            results.push(wholeParseResult);

            if (wholeParseResult.result) {
                const changeResult = controller.handleComponentChange(wholeParseResult.result);
                if (changeResult.success) {
                    render();
                    return;
                }
            }

            if (controller.indexInArray) {
                indexes.unshift(controller.indexInArray);
            }
            indexes.unshift(controller.indexInParent);
            controller = controller.parentController;
        }

        results.forEach(result => console.error(result.error));
     
    }, 500);

    $(dom).on({
        'keydown': (event: KeyboardEvent) => {

            const code = event.keyCode;
            const focused = event.target as HTMLElement;
            const pos = util.getCaretPosition(focused);
            const fraction = util.getCaretFraction(focused);

            if (code === 13) {

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

export const hasControllerAsParent = (start: NodeTextController, search: NodeTextController) => {
    if (!start) return false;
    if (start === search) return true;
    return start.parentController === search || hasControllerAsParent(start.parentController, search);
}

export const getControllerNodeRange = (start: HTMLElement, controller: NodeTextController) : HTMLElement[] => {
    if (getDOMData(start).componentController !== controller) {
        return [];
    }

    let nodes = [start];
    let check = ($el: JQuery) => {
        if (!$el.hasClass('node')) {
            return true;
        }

        const hasController = getDOMData($el).componentController != null;
        return hasController && hasControllerAsParent(getDOMData($el).componentController, controller)
    }

    let before = util.prevWhile($(start), check).filter(el => $(el).hasClass('node')); 
    let after = util.nextWhile($(start), check).filter(el => $(el).hasClass('node'));
    return [].concat(before, nodes, after); 
}

