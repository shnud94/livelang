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

        if (parsedModule.result) {

            const module = parsedModule.result;

            const contextAfterRun = interpreter.evaluateModule(module);
            const {typeCheckContext} = contextAfterRun;

            // Show errors
            typeCheckContext.errors.forEach(error => {
                if (error.kind === 'typeError') {

                    error.nodes.forEach(node => {
                        const $el = $('<div>').text(error.value);
                        lineView.decorations.addClassDecoration('-error', node._id);
                        lineView.decorations.addHoverDecoration($el[0], node._id);
                    })
                }
            });

            typeCheckContext.warnings.forEach(warning => {
                if (warning.kind === 'typeError') {

                    warning.nodes.forEach(node => {
                        const $el = $('<div>').text(warning.value);
                        lineView.decorations.addClassDecoration('-warning', node._id);
                        lineView.decorations.addHoverDecoration($el[0], node._id);
                    })
                }
            });

            // Show results
            if (contextAfterRun) {
                const {resultsPerNode} = contextAfterRun;

                type id = string;
                const idsByLine: { [line: number]: id[] } = {};

                // get all results per line
                _.keys(resultsPerNode).forEach(key => {
                    const {results, node} = resultsPerNode[key];
                    const lineNumber = lineView.lineNumberForId(key);

                    if (lineNumber != null) {
                        idsByLine[lineNumber] = (idsByLine[lineNumber] || []).concat([node._id]);
                    }
                });

                // get the one we should show for that line
                const forEachLine = _.keys(idsByLine).reduce((accum, lineNumber) => {

                    const line = parseInt(lineNumber);
                    const ids = idsByLine[line];
                    if (ids.length === 1) {
                        accum[lineNumber] = ids[0];
                    }
                    else {
                        const highest = ids.sort((a, b) => {
                            const [nodeA, nodeB] = [resultsPerNode[a].node, resultsPerNode[b].node];
                            return AST.hasParent(nodeA, nodeB) ? 1 : -1;
                        })[0];

                        // console.log(`highest for ${lineNumber}: ${highest}`);
                        accum[lineNumber] = highest;
                    }

                    const highest = accum[lineNumber];
                    const node = resultsPerNode[highest].node;
                    const result = $('<span>').addClass('result').text(resultsPerNode[highest].results.last().stringValue())[0];
                    const type = $('<span>').addClass('type').text(types.typeToString(node._runtime.type));

                    lineView.decorations.add(
                        $('<div>').append(type, result)[0],
                        highest,
                        { type: 'lineStart' }
                    );

                    return accum;
                }, {});

                console.log(forEachLine);
            }

        }
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