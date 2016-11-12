interface Array<T> {
    last(): T,
    bringToFront(item: T)
    pushToBack(item: T)
    swap(a: number, b: number)
}

Array.prototype.last = function() {
    return this.length > 0 ? this[this.length - 1] : null;
}

Array.prototype.bringToFront = function<T>(this: Array<T>, item: T) {
    const index = this.indexOf(item);
    if (index >= 0) {
        return this.swap(index, 0)
    }
}

Array.prototype.pushToBack = function<T>(this: Array<T>, item: T) {
    const index = this.indexOf(item);
    if (index >= 0) {
        return this.swap(index, this.length - 1)
    }
}

Array.prototype.swap = function (x,y) {
  var b = this[x];
  this[x] = this[y];
  this[y] = b;
  return this;
}