interface Math {
    clamp(val: number, min: number, max: number) : number
}

Math.clamp = function(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
}