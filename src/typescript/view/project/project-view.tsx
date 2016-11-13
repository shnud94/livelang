import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
import {CommandWindow} from './command-window';
import keys from '../util/keys';
import * as $ from 'jquery';

export function mount(element: HTMLElement, project: project.LiveLangProject) {
    ReactDOM.render(React.createElement(ProjectView, {
        project
    }), element);
}

export interface ProjectViewProps {
    project: project.LiveLangProject
}

export interface ProjectViewState {
    commandWindowOpen: boolean,
}

export class ProjectView extends React.Component<ProjectViewProps, ProjectViewState> {

    constructor(props) {
        super(props);
        this.state = {
            commandWindowOpen: false
        }
    }
    
    componentDidMount() {
        $(window).on('keyup.projectView', this.onKeyUp.bind(this));
    }

    componentWillUnMount() {
        $(window).off('keyup.projectView');
    }

    onKeyUp(event: KeyboardEvent) {
        if (event.altKey && event.keyCode === keys.KEY_P) {
            this.setState(s => {
                s.commandWindowOpen = true;
                return s;
            });
        }
        else if (event.keyCode == keys.ESCAPE) {
            this.onCommandWindowClose();
        }
    }

    onCommandWindowClose() {
        this.setState(s => {
            s.commandWindowOpen = false;
            return s;
        });
    }

    render() : JSX.Element {
        const commandWindowProps = _.extend({
            onClose: this.onCommandWindowClose.bind(this),
            open: this.state.commandWindowOpen
        }, this.props);
        
        return <div className="project-view">
            {this.state.commandWindowOpen && React.createElement(CommandWindow, commandWindowProps)}
            <div className="content">
            </div>
        </div>
    }
}

interface CommandWindowState {
    query: string,
    selectedListIndex: 0
}