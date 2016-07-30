import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from './program';
import {RootComponent} from './typescript/components/index';

const theProgram = new program.Program();
DOM.render(<RootComponent program={theProgram} />, document.getElementById('livelang-root'));



