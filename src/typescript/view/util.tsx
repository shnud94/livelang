import 'jquery.caret';
import * as $ from 'jquery';

function val(el: HTMLElement) : string {
    if (el.tagName.toLowerCase() === 'input') {
        return (el as HTMLInputElement).value;
    }
    return el.innerText;
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