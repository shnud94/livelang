import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
const Fuse = require('fuse.js');
import { ProjectViewProps } from './project-view';
import keys from '../util/keys';

interface CommandWindowState {
    query: string,
    selectedListIndex: number
}
export interface Command {
    name: string,
    doer: (command: string) => void
    type: "file" | "command"
}

export interface CommandCommand extends Command {
    type: "command"
    matcher: (command: string) => void
}

export interface CommandWindowProps extends ProjectViewProps {
    onClose()
    commands: Command[]
}

export class CommandWindow extends React.Component<CommandWindowProps, CommandWindowState> {

    fused: any;

    constructor(props) {
        super(props);
        this.state = {
            query: '',
            selectedListIndex: 0
        }
        this.fused = new Fuse(this.props.commands, { keys: ['name'] })
    }

    getResults(): Command[] {
        return this.state.query.length ? this.fused.search(this.state.query) : [];
    }

    onKeyUp(event: KeyboardEvent) {
        const value = (event.target as HTMLInputElement).value;
        const results = this.getResults();
        const keyCode = event.keyCode;

        if (event.keyCode === keys.RETURN) {
            const result = results[this.state.selectedListIndex];
            if (result) result.doer(value);
            this.props.onClose();
        }
        else if (keyCode === keys.UP_ARROW || keyCode === keys.DOWN_ARROW) {
            this.setState(s => {
                s.selectedListIndex = (s.selectedListIndex + (keyCode === keys.DOWN_ARROW ? 1 : results.length + 1)) % results.length;
                if (isNaN(s.selectedListIndex)) s.selectedListIndex = 0;
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

    render(): JSX.Element {
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