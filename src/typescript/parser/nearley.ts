import * as nearley from 'nearley';
import * as child_process from 'child_process';
import {Result} from '../util/index';
import * as Nearley from 'nearley';
const _eval = require('eval');

export const compileGrammar = (grammar: string) : Result<nearley.Grammar> => {
    try {
        const result = child_process.spawnSync(`nearleyc`, {input: grammar});
        return {result: _eval(result.stdout.toString())};
    } catch (e) {
        return {error: e.message || e};
    }
};

export const compileGrammarFromFile = (path: string) : Result<nearley.Grammar> => {
    try {
        const stdout = child_process.execSync(`nearleyc ${path}`);
        return {result: _eval(stdout.toString())};
    } catch (e) {
        return {error: e.message || e};
    }
};

export const parse = (grammar: nearley.Grammar, input: string) : Result<any> => {
    const parser = new Nearley.Parser(grammar.ParserRules, grammar.ParserStart);

    try {
        parser.feed(input);
    } catch (e) {
        return {error: e.message};
    }

    return {result: parser.results.last()};
};

// let compiledGrammar: any;
// export const getParser = (): Result<nearley.Parser> => {
//     let error: string = null;
//     if (!compiledGrammar) {
//         const maybeCompiled = compileGrammarFromFile('./src/typescript/parse/grammar.ne');
//         compiledGrammar = maybeCompiled.result;
//         error = maybeCompiled.error;
//     }
//     if (error) {
//         console.error(error);
//     }
//     return {
//         error: error, 
//         result: new nearley.Parser(compiledGrammar.ParserRules, compiledGrammar.ParserStart)
//     };
// };
