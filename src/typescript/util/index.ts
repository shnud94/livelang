export interface Result<T> {
    error?: string,
    result?: T
}

export function forceArray<T>(value: T | T[]) : T[] {
    return Array.isArray(value) ? (value as T[]) : [value as T];
}

export function mapObj<T>(obj: {[key: string] : T}, callback: (key: string, value: T) => [string, T]) : {[key: string] : T} {
    return Object.keys(obj).reduce(function(newObj, value) {
        newObj[value] = callback(value, obj[value]);
        return newObj;
    }, {}) as any;
}