import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from './program';
import {RootComponent} from './components/index';
import {NodeComponent, NodeCollection} from './components/ParserTester';
import * as view from './view/index';
import * as js from './frontend/javascriptStyle'

const theProgram = new program.Program();
view.mountProgramView(theProgram, document.getElementById('livelang-root'), js.controllerProvider);