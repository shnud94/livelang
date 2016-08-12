import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from './program';
import * as view from './view/index';
import * as js from './frontend/javascriptStyle';
import * as Frontend from './frontend/index';

const theProgram = new program.Program();
console.log(Frontend);
console.log(js);
const originalEval = (window as any).eval;

const w = window as any;
w.js = js;
w.Frontend = Frontend;
w.view = view;
w.program = program;

view.mountProgramView(theProgram, document.getElementById('livelang-root'), null as any);