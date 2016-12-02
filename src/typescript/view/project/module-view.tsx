import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable'
import * as _ from 'underscore'
import { CommandWindow, Command } from './command-window'
import keys from '../util/keys'
import * as $ from 'jquery'
import * as programLineView from '../module-line-view'
import * as lineView from '../lineView'
import * as AST from '../../AST/index'
import * as parser from '../../parser/custom';
import * as textDesc from '../../frontend/javascriptStyle';
import * as interpreter from '../../interpreter/index';
import * as checker from '../../types/checker';
import * as types from '../../types/index';

interface ModuleViewProps {
    moduleHandle: project.ModuleHandle
}

interface ModuleViewState {
    dirty: boolean
}

export class ModuleView extends React.Component<ModuleViewProps, ModuleViewState> {

    constructor(props) {
        super(props);
        this.state = {
            dirty: false
        }
    }

    lastOpenFile?: project.ModuleHandle

    onLineViewContentChanged(lineView: lineView.LineView<any>, content: string) {

        this.props.moduleHandle.content = content;
        if (this.props.moduleHandle.content !== this.props.moduleHandle._savedContent) {
            this.setState(s => {
                s.dirty = true
                return s;
            });
        }

        const parsedModule = parser.parseSpecCached(textDesc.theModule, content, textDesc.theModule.id);
        console.log(parsedModule);
    }

    setContent(content: HTMLElement | null) {
        if (content && this.lastOpenFile !== this.props.moduleHandle) {
            const view = lineView.create(content, {
                onContentChange: _.debounce(() => this.onLineViewContentChanged(view, view.getAllText()), 250)
            }, () => [{ content: this.props.moduleHandle.content }])

            this.lastOpenFile = this.props.moduleHandle
        }
    }

    onKeyUp(event: KeyboardEvent) {
        if (event.keyCode == keys.KEY_S && event.metaKey) {

            this.props.moduleHandle.save();
            this.setState(s => {
                s.dirty = false;
                return s;
            })
        }
    }

    render(): JSX.Element {
        const fileName = this.props.moduleHandle.filename.split('/').last();
        const classes = ['module-view'];

        if (this.state.dirty) {
            classes.push('-dirty');
        }

        return <div className={classes.join(' ')} onKeyDown={this.onKeyUp.bind(this)}>
            <div className="title-wrap">
                <div className="title">{fileName}</div>
            </div>
            <div ref={(element) => this.setContent(element)} className="content"></div>
        </div>
    }
}