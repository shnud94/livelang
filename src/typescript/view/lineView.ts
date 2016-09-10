import * as $ from 'jquery';
import * as util from './util';
import * as _ from 'underscore';

export type LineElementContent = string | HTMLElement;

export interface LineElement<T> {
    content: LineElementContent
    data?: T
    wholeLine?: boolean,
    lineBreak?: boolean,
    immutable? : boolean,
    classNames?: string
}

interface LineView<ElementType> {
    renderAll()

}
interface DragState {
    start: {x: number, y: number}
    startCharPos: number,
    startLine: JQuery,
    lastHit?: HTMLElement
}
interface State {
    currentDrag?: DragState
}
interface LineData {
    index: number
}
function getLineData(element: JQuery) {
    return element.data() as LineData;
}
interface LineViewOptions<ElementType> {
    onElementChange?(now: string, previous: string) 
}

const isEditable = (j: JQuery) => {
    return j && j.length && !!j.attr('contentEditable') && j.text() !== '\n' && j.text() !== '\t';
}
const editableSibling = (el, direction) => {
    return direction < 0 ? util.firstPrev($(el), isEditable) : util.firstNext($(el), isEditable);
}

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

export function create<T>(container: HTMLElement, options: LineViewOptions<T>, elementCallback: () => LineElement<T>[]) : LineView<T> {
    
    const wrap = $('<div>').addClass('line-view').css('position', 'relative');
    const lineContainer = $('<div>').addClass('lines').appendTo(wrap);
    $(container).append(wrap);
    const canvas = $('<canvas>').appendTo(wrap).css({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        'pointer-events' : 'none'
    })[0] as HTMLCanvasElement;
    const context = () => {
        canvas.width = wrap.width();
        canvas.height = wrap.height();
        return canvas.getContext('2d'); 
    }
    let lines = [];

    function textInLine(line: HTMLElement) {
        return $(line).children('.text').toArray()
            .reduce((accum, cur) => accum + cur, '')
            .join('');
    }

    function getTextWidth(text, style: Object) {
        const self = getTextWidth as any;
        style = _.extend({}, style, {
            position: 'absolute',
            float: 'left',
            'white-space' : 'nowrap',
            visibility: 'hidden'
        });
        self.measuringBox = self.measuringBox || $('<div>').css(style).appendTo('body');
        return self.measuringBox.html(text).outerWidth();
    }

    function charsInAtX(x: number, line: HTMLElement) {
        let charsSoFar = 0;
        let result: any;
        $(line).children('.text').toArray().every(element => {
            const $el = $(element);
            const [min, max] = [$el.position().left, $el.position().left + $el.outerWidth()];
            if(x >= min && x < max) {
                const computed = window.getComputedStyle(element);
                const style = {
                    font: computed.font,
                    letterSpacing: computed.letterSpacing
                }
                const text = $el.text();
                text.split('').forEach((char, index) => {
                    if (result) return;
                    const width = getTextWidth(text.substr(0, index + 1), style);
                    if (x < min + width) {
                        result = {
                            chars: index + charsSoFar,
                            min: min + getTextWidth(text.substr(0, index), style),
                            max: min + width
                        }
                    }
                })
                return false;
            }
            charsSoFar += $el.text().length;
            return true;
        })
        return result;
    }

    function xAtChar(char: number, line: HTMLElement) {

    }

    function handleDrag(event: DragEvent, state: DragState) {
        event.preventDefault();
        console.log(charsInAtX(event.offsetX, state.lastHit));
        const c = context();
        
        c.clearRect(0, 0, canvas.width, canvas.height);
        const highlightStart = [state.start, state.startLine.position().top];
        let lineStart = state.startLine;
        let lineEnd = $($(event.target).closest('.line')[0] || state.lastHit);
        if (!lineEnd[0]) return;
        state.lastHit = lineEnd[0];

        const lineDatas = [getLineData(lineStart), getLineData($(state.lastHit))];
        if (lineDatas[1].index < lineDatas[0].index) {
            // swap them around so we can use the same drawing logic
            const temp = lineStart;
            lineStart = lineEnd;
            lineEnd = temp;
        }
        
        c.fillStyle = 'rgba(0, 0, 255, 0.25)';

        if (state.startLine[0] !== lineEnd[0]) {
            // Draw start
            c.fillRect(state.start.x, lineStart.position().top, Math.abs(lineStart.width() - state.start.x), state.startLine.outerHeight());

            // Draw inbetween
            const inBetween = state.startLine.nextUntil(lineEnd);
            if (inBetween.length > 0) {
                const yRange = [inBetween.first().position().top, inBetween.last().position().top + inBetween.last().outerHeight()];
                c.fillRect(0, yRange[0], lineContainer.width(), yRange[1] - yRange[0]);
            }

            c.fillRect(0, lineEnd.position().top, event.offsetX, lineEnd.outerHeight()); 
        }
        else {
            // Just draw start
            c.fillRect(Math.min(state.start.x, event.offsetX), highlightStart[1] as number, Math.abs(event.offsetX - state.start.x), state.startLine.outerHeight());
        }
    }
    function handleDragEnd(event: DragEvent, dragState: DragState) {
        state.currentDrag = null;
        context().clearRect(0, 0, canvas.width, canvas.height);
    }

    function renderAll() {
        lines = [];
        const elements = elementCallback();

        function createLine() {
            return $('<div>').addClass('line').css({
                width: '100%',
                'white-space': 'nowrap',
                'font-family': 'menlo',
                'letter-spacing': '-0.05em'
            });
        }
        function thisLine() {
            if (lines.length === 0) startNewLine();
            return $(lines.last());
        }
        function startNewLine() {
            lines.push(createLine().data({
                index: lines.length
            } as LineData));
        }

        function textEl(text: string) {
            return $('<span>').addClass('text').attr('contentEditable', 'true').html(text);
        }

        elements.forEach(element => {
            function common(el: JQuery) {
                return el.addClass(element.classNames || '').data(element.data || {}).attr('contentEditable', String(element.immutable !== true));
            }
            if (typeof(element.content) === 'string') {
                const split = element.content
                    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
                    .replace(/ /g, '&nbsp;')
                    .split('\n');

                if (split.length > 1) {
                    split.forEach(text => {
                        startNewLine();
                        thisLine().append(common(textEl(text)));
                    });
                }
                else {
                    thisLine().append(common(textEl(split[0])));
                }
            }
            else {
                thisLine().append(common($(element.content)));
            }
            if (element.lineBreak) {
                startNewLine();
            }
        });

        $(lineContainer).append(lines);
    }
    
    renderAll();
    
    const state: State = {
        currentDrag: null
    }

    wrap.on('keydown' as any, (event: KeyboardEvent) => {
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
    }).on('mousedown mousemove mouseup' as any, (event: MouseEvent) => {

        if (event.type === 'mousedown') {
            const line = $(event.target).closest('.line');
            state.currentDrag = {
                startLine: line,
                startCharPos: util.getCaretPosition(event.target as HTMLElement),
                start: {x: event.offsetX, y: event.offsetY}
            };
        }
        if (event.type === 'mousemove') {
            if (state.currentDrag) {
                event.preventDefault();
                handleDrag(event as DragEvent, state.currentDrag);
            }
        }
        if (event.type === 'mouseup') {
            if (state.currentDrag) {
                event.preventDefault();
                handleDragEnd(event as DragEvent, state.currentDrag);
            }
        }
    });

    return {
        renderAll
    }   
}