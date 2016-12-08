declare function FuzzySet(strings: string[]) : FuzzySetInterface;    
interface FuzzySetInterface {
    /**
     * Can actually return null as well
     */
    get(searchString: string) : [number, string][];
}