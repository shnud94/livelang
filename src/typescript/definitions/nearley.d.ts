declare module 'nearley' {

    interface ParsingThing {
        feed(input: string);
    }

    interface Grammar {
        ParserRules: any,
        ParserStart: any
    }

    export class Parser {
        constructor(rules: any, start: any);
        feed(input: string);
        results: any
    }
}