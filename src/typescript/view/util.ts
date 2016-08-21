import 'jquery.caret';
import * as $ from 'jquery';

function val(el: HTMLElement) : string {
    if (el.tagName.toLowerCase() === 'input') {
        return (el as HTMLInputElement).value;
    }
    return el.innerText;
}

export function siblingsWhile(src: JQuery, callback: ($el: JQuery) => boolean, direction: number) : HTMLElement[] {
    if (direction === 1) { // next

        const last = lastNext(src, $el => callback($el));  
        if (!last || last === src[0]) return [];
        return getElementsInRange(src.next()[0], last);
    }
    else { // prev

        const prev = lastPrev(src, $el => callback($el));  
        if (!prev || prev === src[0]) return [];
        return getElementsInRange(prev, src.prev()[0]);
    }
}

export const getElementsInRange = (start: HTMLElement, end: HTMLElement) => {
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

function firstSibling(src: JQuery, callback: ($el: JQuery) => boolean, direction: number) : HTMLElement {
    if (!src[0]) return null;
    
    if (callback(src)) {
        return src[0];
    }
    else {
        return firstSibling(direction > 0 ? src.next() : src.prev(), callback, direction);
    }
}

export function firstNext(src: JQuery, callback: ($el: JQuery) => boolean) : HTMLElement  {
    return firstSibling(src.next(), callback, 1);
}

export function firstPrev(src: JQuery, callback: ($el: JQuery) => boolean) : HTMLElement  {
    return firstSibling(src.prev(), callback, -1);
}

export function prevWhile(src: JQuery, callback: ($el: JQuery) => boolean) : HTMLElement[] {
    return siblingsWhile(src, callback, -1);
}

export function nextWhile(src: JQuery, callback: ($el: JQuery) => boolean) : HTMLElement[] {
    return siblingsWhile(src, callback, 1);
}

export const textInNodeRange = (first: HTMLElement, last: HTMLElement) => {
    return getElementsInRange(first, last).reduce((accum, curr) => {
     return accum + $(curr).text();
    }, "");
}

export function lastPrev(src: JQuery, callback: ($el: JQuery) => boolean) : HTMLElement {
    if (src.prev()[0] && callback(src.prev())) {
        return lastPrev(src.prev(), callback);
    }
    return src[0];
}

export function lastNext(src: JQuery, callback: ($el: JQuery) => boolean) : HTMLElement {
    if (src.next()[0] && callback(src.next())) {
        return lastNext(src.next(), callback);
    }
    return src[0];
}

export function getCaretOffset(el: HTMLElement) : {left: number, top: number, height: number} {
    return ($(el) as any).caret('offset') as any;
}

export function getCaretFraction(el: HTMLInputElement | HTMLElement) {
    return getCaretPosition(el) / val(el).length;
}

export function setCaretFraction(el: HTMLInputElement | HTMLElement, pos: number) {
const requiredPosition = (pos * Math.ceil(val(el).length));
    setCaretPosition(el,requiredPosition);
}

/**
 * http://stackoverflow.com/a/4302688
 */
export function getCaretPosition(el: HTMLElement) {
    return ($(el) as any).caret('pos');
}

/**
 * http://stackoverflow.com/a/4302688
 */
export function setCaretPosition(el: HTMLElement, pos: number) {
    return ($(el) as any).caret('pos', pos);
}