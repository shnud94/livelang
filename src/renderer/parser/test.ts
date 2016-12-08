import * as nearley from 'nearley';
import * as $ from 'jquery';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as _ from 'underscore';
const _eval = require('eval');

const tmpGrammarLocation = './tmp/parsegrammar.ne',
compiledGrammar = './tmp/parsegrammar.js';

export const createTestEnvironment = (htmlElement: HTMLElement) => {

    const testContainer = $('<div>').addClass('test-container').appendTo(htmlElement);
    const grammarTextArea = $('<textarea>').appendTo(testContainer);
    const input = $('<textarea>').appendTo(testContainer);
    const output = $('<div>').appendTo(testContainer);

    let grammar: any = null;
    const processInput = _.debounce(() => {
        if(!grammar) return;
        try {
            const parser = new nearley.Parser(grammar.ParserRules, grammar.ParserStart);
            parser.feed(input.val());
            output.text(JSON.stringify(parser.results[0]) || '');
            console.log(parser.results);
        } catch (e) {
            output.text(`Error at character ${e.offset}`);
        }
    }, 1000);

    // When grammar changes, save grammar to file, re run everything
    grammarTextArea.on('keyup', e => {
        grammarTextArea.val()
        fs.writeFile(tmpGrammarLocation, grammarTextArea.val(), (err) => {
            
            child_process.exec(`nearleyc parsegrammar.ne`, {cwd: './tmp'}, (error, stdout, sterr) => {                
                if (err) {
                    output.text(err.message + '\n\n' + sterr);
                }    
                else if (sterr) {
                    console.error(sterr);
                    output.text(sterr)
                }
                else if (stdout && stdout.length > 0) {
                    grammar = _eval(stdout);
                    processInput();
                }
            });
        })
    });

    // When input changes, run 
    input.on('keyup', e => {
        processInput();
    });
};