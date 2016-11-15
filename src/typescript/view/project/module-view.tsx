import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
import {CommandWindow, Command} from './command-window';
import keys from '../util/keys';
import * as $ from 'jquery';
import * as programLineView from '../programLineView';
import * as AST from '../../AST/index';

interface ModuleViewProps {
    moduleHandle: project.ModuleHandle
}

interface ModuleViewState {

}

export class ModuleView extends React.Component<ModuleViewProps, ModuleViewState> {

    lastOpenFile?: project.ModuleHandle

    setContent(content: HTMLElement | null) {
        if (content && this.lastOpenFile !== this.props.moduleHandle) {
            programLineView.create(this.props.moduleHandle.root, content, {
                onSuccessfulChange: () => {
                    this.props.moduleHandle.save();
                }
            });
            this.lastOpenFile = this.props.moduleHandle;
        }
    }

    render() : JSX.Element {
        const fileName = this.props.moduleHandle.filename.split('/').last();

        return <div className="module-view">
            <div className="title-wrap">
                <div className="title">{fileName}</div>
            </div>
            <div ref={(element) => this.setContent(element)} className="content"></div>
        </div>
    }
}