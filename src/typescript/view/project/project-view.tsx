import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
import {CommandWindow, Command} from './command-window';
import keys from '../util/keys';
import * as $ from 'jquery';

var count = 0;
export function mount(element: HTMLElement, project: project.LiveLangProject) {
    ReactDOM.render(React.createElement(ProjectView, {
        project,
        something: ++count
    } as any), element);
}

export interface ProjectViewProps {
    project: project.LiveLangProject
}

export interface ProjectViewState {
    commandWindowOpen: boolean,
    commands: Command[],
    openFile: project.ModuleHandle
}

export class ProjectView extends React.Component<ProjectViewProps, ProjectViewState> {

    constructor(props: ProjectViewProps) {
        super(props);
        this.state = {
            commandWindowOpen: false,
            openFile: props.project.getAllModules()[0],
            commands: this.getCommands(props.project)
        }
        $('title')[0].innerText = props.project.rootDir
    }
    
    componentWillReceiveProps(newProps: ProjectViewProps) {
        this.setState(s => {
            s.commands = this.getCommands(newProps.project)
            return s;
        });
    }

    componentDidMount() {
        $(window).on('keyup.projectView', this.onKeyUp.bind(this));
    }

    componentWillUnMount() {
        $(window).off('keyup.projectView');
    }

    getCommands(project: project.LiveLangProject) : Command[] {
        const fileOpens: Command[] = this.props.project.getAllModules().map(module => {
            return {
                name: module.filename,
                type: "file" as "file",
                doer: () => {
                    this.setState(s => {
                        s.openFile = module;
                        return s;
                    });
                }
            }
        });
        return fileOpens;
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
            open: this.state.commandWindowOpen,
            commands: this.state.commands
        }, this.props);
        
        return <div className="project-view">
            {this.state.commandWindowOpen && React.createElement(CommandWindow, commandWindowProps)}
            <div className="content">

                {this.state.openFile ? this.state.openFile.filename : null}
            </div>
        </div>
    }
}

interface CommandWindowState {
    query: string,
    selectedListIndex: 0
}