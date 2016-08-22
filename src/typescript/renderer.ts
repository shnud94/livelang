import './prototype/index';
import * as program from './program';
import * as view from './view/programView';
import * as util from './view/util';
import {remote} from 'electron';
import * as fs from 'fs';
import * as types from './types/index';
import * as settings from './settings/index';
const dialog = remote.dialog;

function loadFromPath(path: string) {
    theProgram = program.programFromJSON(fs.readFileSync(path, 'utf-8'));
    settings.lastOpenedFile.set(path);
    view.mountProgramView(theProgram, content[0]);
}

/**
 * Make jQuery globally accessible for jQuery data chrome extension
 */
const wwindow = window as any;
wwindow.jQuery = require('jquery');
wwindow.$ = wwindow.jQuery;

const root = document.getElementById('livelang-root');
const buttons = $('<div>').addClass('buttons').appendTo(root);
const content = $('<div>').addClass('content').appendTo(root);
let theProgram = new program.Program();
if (settings.lastOpenedFile.get()) {
    loadFromPath(settings.lastOpenedFile.get());
}

const saveLoadFilters = [
    {name: 'JSON', extensions: ['json']}
];

buttons.append($('<button>').text('Save').click(() => {
    dialog.showSaveDialog({filters: saveLoadFilters}, fileName => {
        if (!fileName) return;

        fs.writeFileSync(fileName, program.programToJSON(theProgram));
    });
}));

buttons.append($('<button>').text('Load').click(() => {
    dialog.showOpenDialog({filters: saveLoadFilters}, fileNames => {
        if (!fileNames || fileNames.length === 0) return;

        loadFromPath(fileNames[0]);
    });
}));

view.mountProgramView(theProgram, content[0]);


import * as Nearley from './parser/nearley';

wwindow.nearley = Nearley;
wwindow.custom = require('./parser/custom');
wwindow.jsstyle = require('./frontend/javascriptStyle');
wwindow.view = view;
wwindow.util = util;
wwindow.program = theProgram;
wwindow.types = types;

// import * as test from './parser/test';
// test.createTestEnvironment(document.getElementById('livelang-root'));