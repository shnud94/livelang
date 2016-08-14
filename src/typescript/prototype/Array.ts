interface Array<T> {
    last(): T
}

Array.prototype.last = function() {
    return this.length > 0 ? this[this.length - 1] : null;
}