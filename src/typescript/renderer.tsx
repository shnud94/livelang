import './prototype/index';
import * as program from './program';
import * as view from './view/programView';
import * as util from './view/util';

/**
 * Make jQuery globally accessible for jQuery data chrome extension
 */
const wwindow = window as any;
wwindow.jQuery = require('jquery');
wwindow.$ = wwindow.jQuery;

const theProgram = new program.Program();
view.mountProgramView(theProgram, document.getElementById('livelang-root'));


import * as Nearley from './parser/nearley';

wwindow.nearley = Nearley;
wwindow.custom = require('./parser/custom');
wwindow.jsstyle = require('./frontend/javascriptStyle');
wwindow.view = view;
wwindow.util = util;

// import * as test from './parser/test';
// test.createTestEnvironment(document.getElementById('livelang-root'));