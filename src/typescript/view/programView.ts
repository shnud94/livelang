import * as program from '../program';
import {AST, Program} from '../program';
import * as ASTUtil from '../ast/util';
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
import * as typeChecker from '../types/index';
import * as interpreter from '../interpreter/index';
const logParsing = require('debug')('livelang:parsing');

export type ControllerProvider = (node: AST.CodeNode) => NodeTextController;
export interface DOMData {
    representedNode?: AST.CodeNode
    nodeTextState?: NodeTextController
    initial: string
}

export const getDOMData = (element: JQuery | HTMLElement) : DOMData => {
    return $(element).data() as DOMData;
}

export const mountProgramView = (program: Program, dom: HTMLElement) => {
    
    $(dom).empty();
    const container = $('<div>').addClass('code').appendTo(dom);
    const rootController = basicController(program.data);

    const layoutAll = () => {
        layoutRange(container.children()[0] as HTMLElement, container.children().last()[0] as HTMLElement);
    };

    const nodeBit = () => $('<span>').addClass('node').attr('contentEditable', 'true');

    const convertSpecialChars = (node: HTMLElement) => {
        if ($(node).hasClass('_layout')) return;

        const result = [];
        const nodeData = $(node).data() as DOMData;
        const cloneWithChars = chars => typeof(chars) === 'string' ? result.push($(node).addClass('_layout').clone(true).html(chars)[0]) : undefined;
  
        cloneWithChars(node.innerHTML.split('').reduce((prev, char) => {
            if (char === '\n') {
                cloneWithChars(prev);
                cloneWithChars('\n');
                result.push($('<br>').addClass('_layout')[0]);
                return null;
            }
            else if (char === '\t') {
                cloneWithChars(prev);
                cloneWithChars('\t');
                cloneWithChars('&nbsp;&nbsp;&nbsp;&nbsp;');
                return null;
            }
            else if (char === ' ') {
                cloneWithChars(prev);
                cloneWithChars('&nbsp;');
                return null;
            }
            else {
                return typeof(prev) === 'string' ? (prev + char) : char;
            }            
        }, null));

        result.forEach(r => {
            $(r).data('initial', r.innerText);
        });

        if (!result.length) return;

        $(node).replaceWith(result);
        if (nodeData.nodeTextState.firstNode === node) {
            nodeData.nodeTextState.firstNode = result[0];
        }
    }

    const setCharsIntoController = (controller: NodeTextController, chars: number) => {

        let currentNode = controller.firstNode;
        let accum = 0;

        while (currentNode && !(chars >= accum && chars < accum + $(currentNode).text().length)) {
            accum += $(currentNode).text().length;
            currentNode = $(currentNode).next()[0];            
        } 

        if (currentNode) {
            util.setCaretPosition(currentNode, chars - accum);
        }
    }

    const getCharsIntoController = (controller: NodeTextController, focused: HTMLElement) => {
        let accum = util.getCaretPosition(focused);

        while (focused && focused !== controller.firstNode) {
            accum += $(focused).text().length;
            focused = $(focused).prev()[0];           
        }

        return accum;
    }

    const isEditable = (j: JQuery) => {
        return j && j.length && !!j.attr('contentEditable') && j.text() !== '\n' && j.text() !== '\t';
    }
    const editableSibling = (el, direction) => {
        return direction < 0 ? util.firstPrev($(el), isEditable) : util.firstNext($(el), isEditable);
    }

    const elementsFromController = (controller: NodeTextController) : HTMLElement[] => {

        let result = controller.render();
        let parts: HTMLElement[] = [];
        controller.firstNode = null;

        result.renderables.forEach(renderable => {

            if (typeof(renderable.component) === 'string') {
                const part = nodeBit().text(renderable.component as string).data({
                    initial: renderable.component as string,
                    representedNode: controller.node,
                    nodeTextState: controller
                } as DOMData);
                parts.push(part[0]);
            }
            else {
                // Must be a node
                parts = parts.concat(elementsFromController(basicController(renderable.component as AST.Nodes, controller)));
            }
        });

        controller.firstNode = parts[0];
        return parts;
    }

    const renderControllerRange = (controller: NodeTextController, range: HTMLElement[], focused?: HTMLElement) => {
        controller = rootController; // render the whole fukin thing for now
        range = [];
        
        let charsFromControllerFirstNode: number;
        if (focused) {
            charsFromControllerFirstNode = getCharsIntoController(controller, focused);
        }
        
        const prev = $(range[0]).prev();
        const rendered = $(elementsFromController(controller));
        
        if (prev[0]) {
            $(range).remove();
            rendered.insertAfter(prev);
        }
        else {
            container.empty();
            rendered.appendTo(container);
        }
        
        layoutAll();

        if (focused) {
            setCharsIntoController(controller, charsFromControllerFirstNode);
        }
    }  

    function layoutRange(start: HTMLElement, end: HTMLElement) {
        let tabLevel = 0;
        util.getElementsInRange(start, end).forEach(el => {
            convertSpecialChars(el);
        });
    };

    function handleArrow(event: KeyboardEvent, direction: string, element: HTMLElement, position: number, fraction: number) {

        if (direction === 'left' || direction === 'right') {
            let dirNum = direction === 'left' ? -1 : 1;

            if (fraction === 0 && dirNum === -1) {
                const prev = editableSibling($(element), -1);
                if (prev) {
                    prev.focus();
                    event.preventDefault();
                    util.setCaretPosition(prev, $(prev).text().length - 1);
                }
            }
            else if (fraction === 1 && dirNum === 1) {
                
                const next = editableSibling($(element), 1);
                if (next) {
                    next.focus();
                    event.preventDefault();
                    util.setCaretPosition(next, 1);
                }             
            }
        }
        else if (direction === 'up' || direction === 'down') {
            //debugger;
            event.preventDefault();
            let dirNum = direction === 'down' ? 1 : -1;

            const searchForVerticalSibling = (origin: HTMLElement, direction: number) : {hit?: HTMLElement, xFraction: number} => {
                const x = util.getCaretOffset(origin).left;                    
                
                const findHitEl = (origin: HTMLElement, el: HTMLElement, runCount = 0) : {hit?: HTMLElement, xFraction: number} => {

                    if (!el) return null;
                    const elLeft = $(el).offset().left,
                        elWidth = $(el).outerWidth();
                    
                    if (el !== origin) {
                        let isHit = elLeft <= x && elLeft + elWidth > x;
                        if (isHit) {
                            return {
                                hit: el,
                                xFraction: Math.min(1, Math.max(0, (x - elLeft) / elWidth) + 0.1)
                            };
                        }
                    }

                    if (runCount < 30) {
                        return findHitEl(
                            origin, 
                            editableSibling($(el), direction),
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

        if (value === data.initial) return;

        const results: Result<any>[] = [];
        let controller = data.nodeTextState;
        
        while (controller) {
            const controllerNodeRange = getControllerNodeRange(controller);            
            const textInRange = util.textInNodeRange(controllerNodeRange[0], controllerNodeRange.last());
            const wholeParseResult = parser.parseSpecCached(controller.description, textInRange.trim(), controller.description.id);
            results.push(wholeParseResult);

            if (wholeParseResult.result) {

                const changeResult = controller.handleComponentChange(wholeParseResult.result, textInRange);
                if (changeResult.success) {
                    renderControllerRange(controller, controllerNodeRange, event.target as HTMLElement);
                    
                    const module = ASTUtil.nearestModule(controller.node);
                    if (!module) debugger;
                    else {
                        const contextAfterRun = interpreter.evaluateModule(module);
                        console.log(contextAfterRun);
                    }
        
                    return;
                }
            }

            controller = controller.parentController;
        }

        results.forEach(result => logParsing(result.error));     
    }, 500);

    $(dom).on({
        'keydown': (event: KeyboardEvent) => {

            const code = event.keyCode;
            const focused = event.target as HTMLElement;
            const pos = util.getCaretPosition(focused);
            const fraction = util.getCaretFraction(focused);

            // 8 backspace, 46 delete
            if (fraction === 0 && code === 8) {
                const prev = editableSibling(event.target, -1);
                if (prev) {
                    prev.innerText = prev.innerText.substr(-1);
                    prev.focus();
                    util.setCaretFraction(prev, 1);
                }
            }
            else if (fraction === 1 && code === 46) {
                const next = editableSibling(event.target, 1);
                if (next) {
                    next.innerText = next.innerText.substr(1);
                    next.focus();
                }                
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

    container.append(elementsFromController(rootController));
    layoutAll();
}

export const hasControllerAsParent = (start: NodeTextController, search: NodeTextController) => {
    if (!start) return false;
    if (start === search) return true;
    return start.parentController === search || hasControllerAsParent(start.parentController, search);
}

export const getControllerNodeRange = (controller: NodeTextController) : HTMLElement[] => {
    const start = controller.firstNode;
    let check = ($el: JQuery) => {
        const data =  getDOMData($el);
        if (!data || !data.nodeTextState) {
            return true;
        }

        return hasControllerAsParent(getDOMData($el).nodeTextState, controller);
    }
    return [start].concat(util.nextWhile($(start), check).filter(el => $(el).hasClass('node')));
}

