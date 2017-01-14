declare function FuzzySet(strings: string[]) : FuzzySetInterface;    
interface FuzzySetInterface {
    /**
     * Can actually return null as well
     */
    get(searchString: string) : [number, string][];
}

declare module "line-column" {

    export interface CheckResult {
        fromIndex(index: number): {line: number, column: number}
        toIndex(line: number, column): number
    }

    export type LineChecker = (str: string) => CheckResult;
    export default LineChecker;
}