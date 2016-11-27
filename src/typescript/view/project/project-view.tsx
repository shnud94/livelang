import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
import { CommandWindow, Command } from './command-window';
import keys from '../util/keys';
import * as $ from 'jquery';
import * as programLineView from '../module-line-view';
import { ModuleView } from './module-view';

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
    openFile: project.ModuleHandle | null
}

export class ProjectView extends React.Component<ProjectViewProps, ProjectViewState> {

    _lastCreatedFile: string
    lastOpenFile?: project.ModuleHandle

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

            if (this._lastCreatedFile) {
                const handle = newProps.project.getAllModules().filter(mod => mod.filename.indexOf(this._lastCreatedFile) >= 0)[0];
                if (handle) {
                    s.openFile = handle;
                }
            }
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

    getContentView() {
        if (this.state.openFile) {
            return React.createElement(ModuleView, {
                moduleHandle: this.state.openFile
            });
        }
        else {
            return <div>Nothing to see here!</div>
        }
    }

    getCommands<T extends Command>(project: project.LiveLangProject): T[] {
        const fileOpens: T[] = this.props.project.getAllModules().map(module => {
            return {
                name: module.filename,
                type: "file",
                doer: (command: string) => {
                    this.setState(s => {
                        s.openFile = module;
                        return s;
                    });
                }
            } as T
        });

        const commands = [].concat(fileOpens);
        commands.push({
            name: 'New file',
            type: "command",
            doer: command => {
                const filename = command.split(' ')[1];
                this._lastCreatedFile = filename;
                this.props.project.createNewFile(filename);
            },
            matcher: command => command.startsWith('new')
        })

        return commands;
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

    render(): JSX.Element {
        const commandWindowProps = _.extend({
            onClose: this.onCommandWindowClose.bind(this),
            open: this.state.commandWindowOpen,
            commands: this.state.commands
        }, this.props);

        return <div className="project-view">
            {this.state.commandWindowOpen && React.createElement(CommandWindow, commandWindowProps)}

            {this.getContentView()}
        </div>
    }
}

interface CommandWindowState {
    query: string,
    selectedListIndex: 0
}