import * as nearley from 'nearley';
import * as child_process from 'child_process';
import {Result} from '../util/index';
import * as Nearley from 'nearley';
const _eval = require('eval');

export const compileGrammar = (grammar: string) : Result<nearley.Grammar> => {
    try {
        const result = child_process.spawnSync(`nearleyc`, {input: grammar});
        return {result: _eval(result.stdout.toString(), true)};
    } catch (e) {
        return {error: e.message || e};
    }
};

export const compileGrammarFromFile = (path: string) : Result<nearley.Grammar> => {
    try {
        const stdout = child_process.execSync(`nearleyc ${path}`);
        return {result: _eval(stdout.toString(), true)};
    } catch (e) {
        return {error: e.message || e};
    }
};

export const parse = (grammar: nearley.Grammar, input: string) : Result<any> => {
    const parser = new Nearley.Parser(grammar.ParserRules, grammar.ParserStart);

    try {
        parser.feed(input);
    } catch (e) {
        return {error: e.stack};
    }

    return {result: parser.results.last()};
};