import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
const Fuse = require('fuse.js');
import {ProjectViewProps} from './project-view';
import keys from '../util/keys';

interface CommandWindowState {
    query: string,
    selectedListIndex: number
}
interface Command {
    name: string,
    doer: Function
}

interface CommandWindowProps extends ProjectViewProps {
    onClose()
}

export class CommandWindow extends React.Component<CommandWindowProps, CommandWindowState> {

    commands: Command[] = [
        {
            name: 'Open File',
            doer: () => alert('opening!')
        },
        {
            name: 'Save File',
            doer: () => alert('saving!')
        },
        {
            name: 'Load File',
            doer: () => alert('loading!')
        }
    ]
    fused = new Fuse(this.commands, {keys:['name']})

    constructor(props) {
        super(props);
        this.state = {
            query: '',
            selectedListIndex: 0
        }
    }

    getResults() : Command[] {
        return this.state.query.length ? this.fused.search(this.state.query) : [];
    }

    onKeyUp(event: KeyboardEvent) {
        const value = (event.target as HTMLInputElement).value;
        const results = this.getResults();
        const keyCode = event.keyCode;

        if (event.keyCode === keys.RETURN) {
            results[this.state.selectedListIndex].doer();
            this.props.onClose();
        }
        else if (keyCode === keys.UP_ARROW || keyCode === keys.DOWN_ARROW) {
            this.setState(s => {
                s.selectedListIndex = (s.selectedListIndex + (keyCode === keys.DOWN_ARROW ? 1 : results.length + 1)) % results.length;
                return s;
            });
        }
        else {
            this.setState(s => {
                s.query = value;
                return s;
            })
        }
    }

    render() : JSX.Element {
        const resultsHtml = this.getResults().map((result, index) => {
            return <div className={`result ${this.state.selectedListIndex === index ? '-selected' : ''}`}>
                ${result.name}
            </div>
        });
        const resultsWrap = resultsHtml.length ? <div className={`results ${resultsHtml.length ? '-some' : '-none'}`}>
                {resultsHtml}
        </div> : <div className="no-results">No results</div>;

        return <div className={`command-window`}>
            <input type="text" onKeyUp={this.onKeyUp.bind(this)} autoFocus={true} />
            {resultsWrap}
        </div>
    }
}