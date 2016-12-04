import * as $ from 'jquery';
import * as util from './util';
import * as _ from 'underscore';

export type LineElementContent = string | HTMLElement;

export interface LineElement<T> {
    ids?: string[]
    content: LineElementContent
    data?: T
    wholeLine?: boolean,
    immutable?: boolean,
    classNames?: string
}
export interface LineElementDomData {
    info: LineElementInfo,
    data: any,
    ids?: string[]
}

export interface LineElementInfo {
    first: HTMLElement,
    last: HTMLElement
}

export interface DecorationOptions {
    type: 'lineStart' | 'lineEnd' | 'below'
}

export type LineView<ElementType> = {
    renderAll()
    getAllText(): string
    getElementsWithId(id: string): HTMLElement[],
    lineNumberForId(id: string): number
    decorations: {
        add(decoration: HTMLElement, toId: string, options: DecorationOptions),
        addHoverDecoration(decoration: HTMLElement, toId: string),
        addCSSDecoration(css: CSSStyleDeclaration, toId: string),
        addClassDecoration(clazz: string, toId: string)
        remove(id: string)
    }
}
interface DragState {
    start: { x: number, y: number }
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
    onElementChange?(now: string, previous: string, data: ElementType)
    onContentChange?()
}

function getDomData(el: HTMLElement): LineElementDomData {
    return $(el).data() as LineElementDomData;
}

function enclosingLine(element: HTMLElement): HTMLElement {
    return $(element).closest('.line')[0];
}

function focusedCharIndexInLine(line: HTMLElement): number {
    const focused = document.activeElement as HTMLElement;
    if (focused) {
        return $(focused).prevAll('.text').toArray().reverse().map((e) => e.innerText).join('').length + util.getCaretPosition(focused);
    }
    return 0;
}

function focusCharIndexInLine(line: HTMLElement, index: number): boolean {
    let accum = 0;
    const success = !$(line).children('.text').toArray().every((element) => {

        const length = textOfText(element).length;
        if (index >= accum && index < accum + length) {
            focusAndStuff(element);
            util.setCaretPosition(element, index - accum);
            return false;
        }

        accum += textOfText(element).length;
        return true;
    }, 0);

    if (!success) {
        $(line).find('.text').last().focus();
    }
    return success;
}

function isEditable(j: JQuery) {
    return j && j.length && !!j.attr('contentEditable');
}

function editableSiblingInfo(el, direction, crossLines = true): { el: HTMLElement, crossedLines: boolean } {
    let found = direction < 0 ? util.firstPrev($(el), isEditable) : util.firstNext($(el), isEditable);
    if (!found && crossLines) {
        const line = enclosingLine(el);
        const targetLine = $(direction < 0 ? $(line).prev('.line') : $(line).next('.line'));
        if (targetLine[0]) {
            const startEnd = direction < 0 ? targetLine.children('.text').last()[0] : targetLine.children('.text').first()[0];
            return {
                el: startEnd || editableSibling(startEnd, direction, true),
                crossedLines: true
            }
        }
    }
    return { el: found, crossedLines: false };
}
function editableSibling(el, direction, crossLines = true): HTMLElement {
    let found = direction < 0 ? util.firstPrev($(el), isEditable) : util.firstNext($(el), isEditable);
    if (!found && crossLines) {
        const line = enclosingLine(el);
        const targetLine = $(direction < 0 ? $(line).prev('.line') : $(line).next('.line'));
        if (targetLine[0]) {
            const startEnd = direction < 0 ? targetLine.children('.text').last()[0] : targetLine.children('.text').first()[0];
            return startEnd || editableSibling(startEnd, direction, true);
        }
    }
    return found;
}

function textInElementRange(elementInfo: LineElementInfo) {
    return getTextInRange(elementInfo.first, elementInfo.last);
}

function cleanUp(el: HTMLElement, direction: number) {

    if (el && el.innerText.length === 0) {
        const sibling = editableSibling(el, direction, false);
        $(el).remove();
        return cleanUp(sibling, direction);
    }

    return el;
}

function focusAndStuff(target: HTMLElement) {
    $(target).focus();
    $('.line').removeClass('focused');
    $(enclosingLine(target)).addClass('focused');
}

function handleArrow(event: KeyboardEvent, direction: string, element: HTMLElement, position: number, fraction: number) {
    if (direction === 'left' || direction === 'right') {
        let dirNum = direction === 'left' ? -1 : 1;

        if ((element.innerText.length === 0 || fraction === 0) && dirNum === -1) {
            const prev = editableSibling($(element), -1);
            if (prev) {
                focusAndStuff(prev);
                event.preventDefault();
                util.setCaretPosition(prev, $(prev).text().length - 1);
            }
        }
        else if ((element.innerText.length === 0 || fraction === 1) && dirNum === 1) {

            const next = editableSibling($(element), 1);
            if (next) {
                focusAndStuff(next);
                event.preventDefault();
                util.setCaretPosition(next, 1);
            }
        }
    }
    else if (direction === 'up' || direction === 'down') {
        event.preventDefault();
        let dirNum = direction === 'down' ? 1 : -1;

        const line = enclosingLine(element);
        const focused = focusedCharIndexInLine(line);
        const sibling = dirNum < 0 ? $(line).prev('.line')[0] : $(line).next('.line')[0];
        const success = focusCharIndexInLine(sibling, focused);
        if (!success) {
            const target = dirNum < 0 ? $(sibling).children('.text').last()[0] : $(sibling).children('.text').first()[0];
            focusAndStuff(target);
            util.setCaretFraction(target, dirNum < 0 ? 1 : 0);
        }
    }
};

function textOfText(el: HTMLElement) {
    return $(el.firstChild).text();
}

function setTextOfText(el: HTMLElement, text: string) {
    return $(el.firstChild).text(text);
}

function getTextInRange(start: HTMLElement, end: HTMLElement): string {
    if (start === end) return textOfText(start);

    const array: string[] = [];

    function next(el: HTMLElement): HTMLElement {
        const info = editableSiblingInfo(el, 1, true);
        if (info.crossedLines) {
            array.push('\n');
        }
        return info.el;
    }

    let theNext = start;
    do {
        array.push(textOfText(theNext));
        if (theNext === end) {
            break;
        }
        theNext = next(theNext);
    } while (theNext)

    return array.join('');
}

function changed<T>(textElement: HTMLElement, previous: string, options: LineViewOptions<T>) {
    if (options.onElementChange) {
        const data = getDomData(textElement);
        const text = textInElementRange(data.info);
        options.onElementChange(text, null, data.data);
    }
    if (options.onContentChange) {
        options.onContentChange();
    }
}

export function create<T>(container: HTMLElement, options: LineViewOptions<T>, elementCallback: () => LineElement<T>[]): LineView<T> {

    $(container).empty();
    const wrap = $('<div>').addClass('line-view').css('position', 'relative');
    const nodesById: { [id: string]: Set<HTMLElement> } = {};
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mut => {
            Array.prototype.slice.call(mut.addedNodes).forEach(nodeAdded);
            Array.prototype.slice.call(mut.removedNodes).forEach(nodeRemoved);
        })
    });
    observer.observe(container, {
        subtree: true,
        childList: true
    });

    function nodeAdded(node: HTMLElement) {
        const data = getDomData(node);
        if (Array.isArray(data.ids)) {
            data.ids.forEach(id => {
                nodesById[id] = nodesById[id] || new Set();
                nodesById[id].add(node);
            });
        }
        // Call for each child because sometimes we add things to an element before actually inserting it into the DOM,
        // which stops events from firing for those child nodes
        $(node).children().each((i, child) => nodeAdded(child as HTMLElement));
    }

    function nodeRemoved(node: HTMLElement) {
        const data = getDomData(node);
        if (Array.isArray(data.ids)) {
            data.ids.forEach(id => {
                nodesById[id].delete(node);
                if (!nodesById[id].size) {
                    delete nodesById[id];
                }
            });
        }
        $(node).children().each((i, child) => nodeRemoved(child as HTMLElement));
    }

    const lineContainer = $('<div>').addClass('lines').appendTo(wrap);
    $(container).append(wrap);
    const canvas = $('<canvas>').appendTo(wrap).css({
        position: 'absolute',
        top: 0,
        right: 0,
        'pointer-events': 'none'
    })[0] as HTMLCanvasElement;
    const context = () => {
        $(canvas).css({
            width: lineContainer.width(),
            height: lineContainer.height(),
        });
        canvas.width = lineContainer.width();
        canvas.height = lineContainer.height();
        return canvas.getContext('2d');
    }
    let lines = [];

    function textInLine(line: HTMLElement) {
        return $(line).children('.text').toArray()
            .reduce((accum, cur) => accum + cur, '');
    }

    function getTextWidth(text, style: Object) {
        const self = getTextWidth as any;
        style = _.extend({}, style, {
            position: 'absolute',
            float: 'left',
            'white-space': 'nowrap',
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
            if (x >= min && x < max) {
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

    function xAtChar(char: number, line: HTMLElement): number {
        return null; // TODO
    }

    function handleDrag(event: DragEvent, state: DragState) {
        event.preventDefault();
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

    function createLine() {
        return $('<div>').addClass('line').css({
            width: '100%',
            'white-space': 'nowrap',
            'font-family': 'menlo',
            'letter-spacing': '-0.05em',
            'user-select': 'none'
        }).append(textEl(''));
    }

    function rectifyLine(el: HTMLElement) {
        if ($(el).children().length === 0) {
            $(el).remove();
        }
    }

    var focus: { line: number, char: number } = null;
    function saveFocus() {
        const line = $(document.activeElement).closest('.line');
        const lineIndex = line.index();
        const charIndex = focusedCharIndexInLine(line[0]);

        focus = { line: lineIndex, char: charIndex };
    }

    function restoreFocus() {
        if (focus) {
            const line = lineContainer.children().get(focus.line);
            focusCharIndexInLine(line, focus.char);
            focus = null;
        }
    }

    function textEl(text: string) {
        return $('<span>').css({
            'user-select': 'none',
            'white-space': 'pre',
            'display': 'inline-block',
            'position': 'relative'
        }).addClass('text').attr('contentEditable', 'true').html(text);
    }

    function renderAll() {
        saveFocus();

        lineContainer.empty();
        lines = [];
        let elements = elementCallback();

        function thisLine() {
            if (lines.length === 0) startNewLine();
            return $(lines.last());
        }
        function startNewLine() {
            lines.push(createLine().data({
                index: lines.length
            } as LineData));
        }

        function textElCommon(el: JQuery, lineElement?: LineElement<any>) {
            return el.addClass(lineElement ? lineElement.classNames || '' : '').data({
                data: lineElement ? lineElement.data : {},
                ids: lineElement ? lineElement.ids : []
            }).attr('contentEditable', String(lineElement.immutable !== true));
        }

        // Make sure we have at least something to edit or no lines will appear
        if (elements.length === 0) {
            elements = [{content: ''}];
        }
        
        elements.forEach(lineElement => {            
            if (typeof (lineElement.content) === 'string') {
                let split = lineElement.content
                    .replace(/\t/g, '&nbsp;&nbsp;')
                    .replace(/ /g, '&nbsp;');

                while (split.indexOf('\n') >= 0) {

                    const before = split.substr(0, split.indexOf('\n'));
                    if (before.length > 0) {
                        thisLine().append(textElCommon(textEl(before), lineElement));
                    }
                    startNewLine();
                    split = split.substr(split.indexOf('\n') + 1);
                }

                if (split.length > 0) {
                    thisLine().append(textElCommon(textEl(split), lineElement));
                }
            }
            else {
                thisLine().append(textElCommon($(lineElement.content), lineElement));
            }
        });

        $(lineContainer).append(lines);
        lines.forEach(nodeAdded);

        restoreFocus();
    }

    renderAll();

    const state: State = {
        currentDrag: null
    }

    function handleKeyDown(event: KeyboardEvent, newTarget?: HTMLElement) {

        const code = event.keyCode;

        // Quick fix for higher ups listening to these two keys, don't wanna do anything here
        if (code === 13 && event.ctrlKey) return;

        let focused = newTarget || event.target as HTMLElement;
        const pos = util.getCaretPosition(focused);
        const fraction = util.getCaretFraction(focused);
        const line = enclosingLine(focused);

        if (code === 9 && $(focused).hasClass('text')) {
            // tab
            event.preventDefault();
            const insert = focused.innerText.length > 0 ? util.getCaretPosition(focused) : 0;
            focused.innerText = focused.innerText.substr(0, insert) + String.fromCharCode(160, 160) + focused.innerText.substr(insert);
            util.setCaretPosition(focused, insert + 2);
            changed(focused, null, options);
            return;
        }

        if (code === 32 && $(focused).hasClass('text')) {
            // space
            event.preventDefault();
            const insert = focused.innerText.length > 0 ? util.getCaretPosition(focused) : 0;
            focused.innerText = focused.innerText.substr(0, insert) + String.fromCharCode(160) + focused.innerText.substr(insert);
            util.setCaretPosition(focused, insert + 1);
            changed(focused, null, options);
            return;
        }

        if (code === 13 && $(focused).hasClass('text')) {
            const target = $(focused);
            if (line) {
                event.preventDefault();
                const offset = util.getCaretPosition(target[0]);
                const [start, end] = [textOfText(target[0]).substr(0, offset), textOfText(target[0]).substr(offset)];
                const splitB = target.clone(true);
                target.text(start);
                splitB.text(end).insertAfter(target);
                const data = getDomData(focused);

                const newLine = createLine();
                const elements = _.flatten([splitB.toArray(), splitB.nextAll().toArray()]);
                $(elements).prependTo(newLine);
                newLine.insertAfter(line);
                focusAndStuff(splitB.data(data)[0]);

                if (textOfText(target[0]).length === 0 && $(line).children().length > 1) {
                    target.remove();
                    rectifyLine(line);
                }
                changed(focused, null, options);
                return;
            }
        }

        function moveLineUp(line: HTMLElement) {
            const previous = $(line).prev('.line')[0];
            if (previous) {
                $(line).children().appendTo(previous);
                $(line).remove();
                return previous;
            }
        }

        // 8 backspace, 46 delete
        if ((focused.innerText.length === 0 || fraction === 0) && code === 8) {
            event.preventDefault();
            cleanUp($(focused).prev('.text')[0], -1);
            const prev = editableSibling(focused, -1, false);

            if (prev) {
                prev.innerText = prev.innerText.substr(0, prev.innerText.length - 1);
                focusAndStuff(prev);
                util.setCaretFraction(prev, 1);
            }
            else {
                const prevLine = moveLineUp(line);
                if (document.body.contains(focused)) {
                    focusAndStuff(focused);
                }
                else {
                    focusAndStuff($(prevLine).children().last()[0]);
                }
            }
            return changed(focused, null, options);
        }
        else if ((focused.innerText.length === 0 || fraction === 1) && code === 46) {
            event.preventDefault();
            cleanUp($(focused).next('.text')[0], 1);
            const next = editableSibling(focused, 1, false);

            if (next) {
                next.innerText = next.innerText.substr(1);
                focusAndStuff(next);
            }
            else {
                const prevLine = moveLineUp($(line).next('.line')[0]);
                if (document.body.contains(focused)) {
                    focusAndStuff(focused);
                }
                else {
                    focusAndStuff($(prevLine).children().last()[0]);
                }
            }
            return changed(focused, null, options);
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
    }

    wrap.on('keydown' as any, handleKeyDown)
        .on('keyup' as any, (event: KeyboardEvent) => {
            if ($(event.target).hasClass('text')) {
                changed(event.target as HTMLElement, null, options);
            }
        })
        .on('mousedown mousemove mouseup' as any, (event: MouseEvent) => {

            if (event.type === 'mousedown') {
                event.preventDefault();
                const line = $(event.target).closest('.line');

                if ($(event.target).hasClass('text')) {
                    focusAndStuff(event.target as HTMLElement)
                }
                else {
                    const toFocus = $(line).find('.text').last()[0];
                    focusAndStuff(toFocus);
                    util.setCaretFraction(toFocus, 1);
                }


                state.currentDrag = {
                    startLine: line,
                    startCharPos: util.getCaretPosition(event.target as HTMLElement),
                    start: { x: event.offsetX, y: event.offsetY }
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

    function getAllText() {
        return getTextInRange($(lineContainer).find('.text').first()[0], $(lineContainer).find('.text').last()[0]);
    }

    function lineNumberForId(id: string): number | null {
        const lineWithMost: any[] = _.chain(getElementsWithId(id)).countBy(e => getLineData($(enclosingLine(e))).index).pairs().max(_.last as any).value() as any;
        return lineWithMost.length === 0 ? null : lineWithMost[0];
    }

    function getElementsWithId(id: string): HTMLElement[] {
        return Array.from(nodesById[id] || new Set());
    }



    const decorations = {
        _lineDecorations: {},
        addClassDecoration(clazz: string, toId: string) {
            getElementsWithId(toId).forEach(element => {
                $(element).addClass(clazz);
            });
        },
        addCSSDecoration(decoration: CSSStyleDeclaration, toId: string) {
            getElementsWithId(toId).forEach(element => {
                $(element).css(decoration);
            });
        },
        addHoverDecoration(decoration: HTMLElement, toId: string) {

            getElementsWithId(toId).forEach(element => {
                let hoverDec = $(element).find('.decoration.-hover');
                if (!hoverDec.length) {
                    hoverDec = $('<span>').addClass('decoration -hover');
                    $(element).append(hoverDec);
                }
                hoverDec.append($(decoration).clone());
            });
        },
        addEndOfLineDecoration(element: HTMLElement, lineNumber: number) {
            const line = lineContainer.children().eq(lineNumber)
            if (line) {
                const decoration = $('<div>').addClass('decoration end-of-line').appendTo(line);
                decoration.append(element);
                return {
                    close() {
                        decoration.remove();
                    }
                }
            }
            return {close(){}}
        },
        addWholeLineDecoration(element: HTMLElement, lineNumber: number) {
            const line = lineContainer.children().eq(lineNumber)
            if (line) {
                const decoration = $('<div>').addClass('decoration whole-line').insertAfter(line);
                decoration.append(element);
                return {
                    close() {
                        decoration.remove();
                    }
                }
            }
            return {close(){}}
        },
        add(decoration: HTMLElement, toId: string, options: DecorationOptions) {

            const elements = getElementsWithId(toId);
            if (elements.length === 0) return console.warn('No elements found with id');

            if (options.type === 'lineStart' || options.type === 'lineEnd') {

                const line = $(lineContainer).find('.line').get(lineNumberForId(toId));
                const decorationWrap = $('<div>').addClass(`decoration -${options.type}`).prependTo(line);

                $(decorationWrap).append(decoration);
            }
            else if (options.type === 'below') {
                getElementsWithId(toId).forEach(element => {
                    $(element).append(decoration);
                });
            }

        },
        remove(id: string) {

        }
    }

    return {
        getAllText,
        renderAll,
        getElementsWithId,
        decorations,
        lineNumberForId
    }
}