export interface Result<T> {
    error?: string,
    result?: T
}

export function forceArray<T>(value: T | T[]) : T[] {
    return Array.isArray(value) ? (value as T[]) : [value as T];
}