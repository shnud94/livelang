export function getCaretFraction(input: HTMLInputElement) {
    return getCaretPosition(input) / input.value.length;
}

export function setCaretFraction(input: HTMLInputElement, pos: number) {
    const requiredPosition = pos / input.value.length;
    setCaretPosition(input,requiredPosition);
}

/**
 * http://stackoverflow.com/a/4302688
 */
export function getCaretPosition(input: HTMLInputElement) {
    var CaretPos = 0;

    if (input.selectionStart || input.selectionStart == 0) { // Standard.
        CaretPos = input.selectionStart;
    }
    else if ((document as any).selection) { // Legacy IE
        input.focus();
        var Sel = (document as any).selection.createRange();
        Sel.moveStart('character', -input.value.length);
        CaretPos = Sel.text.length;
    }

    return (CaretPos);
}

/**
 * http://stackoverflow.com/a/4302688
 */
export function setCaretPosition(input: HTMLInputElement, pos: number) {
    if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(pos, pos);
    }
    else if (input.createTextRange) {
        var range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', pos);
        range.moveStart('character', pos);
        range.select();
    }
}