export interface Result<T> {
    error?: string,
    result?: T
}

export interface LLResult<E, R> {
    error?: E,
    result?: R
}

export class LLError {
    constructor(public message?: string) {}
}

export function forceArray<T>(value: T | T[]) : T[] {
    return Array.isArray(value) ? (value as T[]) : [value as T];
}

export function mapObj<T, G>(obj: {[key: string] : T}, callback: (key: string, value: T) => [string, G]) : {[key: string] : G} {
    return Object.keys(obj).reduce(function(newObj, value) {
        let [k, v] = callback(value, obj[value]);
        newObj[k] = v;
        return newObj;
    }, {}) as any;
}