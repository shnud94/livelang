import * as reactive from '../reactive';
import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from '../program';
import {AST, Helpers, Program} from '../program';
import {VariableDeclaration, VariableDeclarationProps} from './variableDeclaration';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as util from '../view/util';
const Fuse: any = require('fuse.js');

export interface NodeProps<T> {
    node: T
}
interface RootComponentProps {
    program: program.Program;
}
export class RootComponent extends React.Component<RootComponentProps, any> {

    render(): JSX.Element {
        return <ScopeNode node={this.props.program.data} />;
    }
}

class ScopeNode extends React.Component<NodeProps<AST.ScopeNode>, any> {

    render(): JSX.Element {
        const theNode = this.props.node;
        return <div className="scopeNode" key={theNode._id}>
            {theNode.type.toString() } {" {"}
            <CodeNodeCollection parent={this.props.node} nodes={this.props.node.children} />
            {"}"}
        </div>
    }
}

interface EmptyNodeState {
    completion?: EmptyNodeCompletion,
    showCompletion: boolean
}
interface EmptyNodeCompletion {
    text: string,
    doer: () => void
}
interface EmptyNodeProps {
    onNodeFilled: () => void
}
type EmptyNodePropsProps = EmptyNodeProps & NodeProps<AST.CodeNode>;

/**
 * Shows an empty node with an input ready to create a new node
 * While typing is happening, a summary is shown underneath to tell the user what they will create if they hit enter
 */
class EmptyNode extends React.Component<EmptyNodePropsProps, EmptyNodeState> {

    constructor(props: EmptyNodePropsProps) {
        super(props);
        this.state = {
            showCompletion: false
        }
    }

    /**
     * Most ideal suggestion is first
     */
    suggestions(): EmptyNodeCompletion[] {
        const types: EmptyNodeCompletion[] = Helpers.getAllowedChildTypes(this.props.node.parent).map(t => {
            return {
                text: t,
                doer() { alert('hello') }
            }
        });
        const variables: EmptyNodeCompletion[] = Helpers.declaredIdentifiersAtNode(this.props.node).map(i => {
            return {
                text: i.type,
                doer() { alert('hello') }
            }
        });
        return [].concat.apply([], [variables, types]);
    }

    render(): JSX.Element {

        const keyUpHandler = (event: KeyboardEvent) => {
            if (this.state.completion && (event.keyCode || event.charCode) == 13) {
                this.state.completion.doer();
                this.setState(s => {
                    s.completion = null;
                    return s;
                });
            }

            const getCompletion = (event: KeyboardEvent): EmptyNodeCompletion => {
                const target = event.target as HTMLInputElement,
                    currentText = target.value,
                    maybeParsedVariable = Helpers.parseStringToVariable(currentText);

                if (maybeParsedVariable) {
                    const program = Program.programFromNode(this.props.node),
                        parsedVariable = maybeParsedVariable as AST.TypedValue;

                    return {
                        text: `${parsedVariable.value}: ${parsedVariable.type}`,
                        doer: () => {
                            let node = this.props.node as AST.VariableDeclarationNode;
                            node.type = AST.CodeNodeTypes.variableDeclaration;
                            node.initialValue = {
                                _id: program.getNextId(),
                                type: AST.CodeNodeTypes.literalNode,
                                value: parsedVariable,
                                parent: node
                            };
                            node.mutable = true;
                            node.identifier = `${parsedVariable.type + program.getNextId()}`
                            this.props.onNodeFilled();
                        }
                    }
                }

                const fuse = new Fuse(this.suggestions(), {
                    keys: ['text']
                })
                return fuse.search(currentText)[0];
            }

            const completion = getCompletion(event);
            this.setState(s => {
                s.completion = completion || null;
                s.showCompletion = true;
                return s;
            });
        }

        let completion: JSS = null;
        if (this.state.completion && this.state.showCompletion) {
            completion = <div className="completion">{this.state.completion.text}</div>;
        }

        const onFocusBlur = (focus: boolean) => {
            this.setState(s => {
                s.showCompletion = focus;
                return s;
            });
        }

        return <div className="codeLine emptyNode">
            <input onFocus={onFocusBlur.bind(this, true) } onBlur={onFocusBlur.bind(this, false) }  onKeyUp={keyUpHandler.bind(this) } />
            {completion}
        </div>
    }
}

interface CodeNodeProps {
    parent: AST.CodeNode
    nodes: AST.CodeNode[]
}
interface CodeNodeCollectionState {
    activeNodeId: string
}
interface CodeNodeEventData {
    handled: boolean;
}
type JSS = JSX.Element | string;
class CodeNodeCollection extends React.Component<CodeNodeProps, any> {

    nodeCommon(theNode: AST.CodeNode, content: JSS): JSS {
        return <div key={theNode._id}>{content}</div>;
    }

    nodeForChild(child: AST.CodeNode): JSS {

        const onReturn = (nodeId: string, end: boolean) => {
            const index = this.props.nodes.findIndex(node => node._id === nodeId),
                program = Program.programFromNode(this.props.parent),
                emptyNode = program.createEmptyNode(this.props.parent);

            if (end) {
                this.props.nodes.splice(index + 1, 0, emptyNode);
            }
            else {
                this.props.nodes.splice(index, 0, emptyNode);
            }
            this.forceUpdate();
        };

        if (child.type === AST.CodeNodeTypes.module) {
            const moduleNode = child as AST.ModuleNode;
            return this.nodeCommon(child, <ScopeNode node={moduleNode} />);
        }
        else if (child.type === AST.CodeNodeTypes.func) {

        }
        else if (child.type === AST.CodeNodeTypes.variableDeclaration) {
            const props: VariableDeclarationProps  = {
                node: child as AST.VariableDeclarationNode,
                onReturnEnd: nodeId => onReturn(nodeId, true),
                onReturnStart: nodeId => onReturn(nodeId, false)
            }
            return this.nodeCommon(child, React.createElement(VariableDeclaration, props));
        }
        else if (child.type === AST.CodeNodeTypes.noop) {
            const onNodeFilled = () => {
                this.forceUpdate();
            };
            return this.nodeCommon(child, <EmptyNode onNodeFilled={onNodeFilled} node={child} />);
        }
        else {
            return <div>'Unsupported Node'</div>;
        }
    }

    render(): JSX.Element {

        if (this.props.nodes.length == 0) {
            const program = Program.programFromNode(this.props.parent),
                emptyNode = program.createEmptyNode(this.props.parent);
            this.props.nodes.push(emptyNode);
        }

        let children = this.props.nodes.map(this.nodeForChild.bind(this));

        const onKeyPress = (event: KeyboardEvent) => {
            if (event.keyCode === 27) { // esc

            }
            else if (event.keyCode == 37) { //left arrow

            }
            else if (event.keyCode == 38) { //up arrow

            }
            else if (event.keyCode == 39) { //right arrow

            }
            else if (event.keyCode == 40) { //down arrow

            }
        }

        return <div>
            {children}
        </div>
    }
}

export interface LineLikeProps {
    onReturnEnd: (nodeId: string) => void
    onReturnStart: (nodeId: string) => void
}

export interface LineLikeCallbacks {
    goToLineEnd: () => void
    goToLineStart: () => void
    getNextInput?: (current: HTMLInputElement) => HTMLInputElement
    getPreviousInput?: (current: HTMLInputElement) => HTMLInputElement
}

export function wrapLineLike(content: JSX.Element, callbacks: LineLikeCallbacks): any {


    return React.createElement(content.type as string, _.extend({}, content.props, {

        onKeyUp: (event: KeyboardEvent) => {
            (content.props.onKeyUp || (() => { }))(event);
            
            if (event.ctrlKey && event.key === 'e') {
                callbacks.goToLineEnd();
            }
            else if (event.ctrlKey && event.key === 'a') {
                callbacks.goToLineStart();
            }
            else if (event.keyCode === 37) {
                // Left arrow
                const maybeInput = $(event.target),
                    input = maybeInput[0] as HTMLInputElement;
                if (input.tagName.toLowerCase() !== 'input') {
                    return;
                }

                if (util.getCaretPosition(input) === 0) {
                    let prev = (callbacks.getPreviousInput && callbacks.getPreviousInput(input)) || $(input).prevAll('input')[0] as HTMLInputElement;
                    if (!prev || prev === input) return;

                    prev.focus();
                    util.setCaretPosition(prev, prev.value.length);
                }
            }
            else if (event.keyCode === 39) {
                // Right arrow
                const maybeInput = $(event.target),
                    input = maybeInput[0] as HTMLInputElement;
                if (input.tagName.toLowerCase() !== 'input') {
                    return;
                }

                if (util.getCaretPosition(input) === input.value.length) {
                    let next = (callbacks.getNextInput && callbacks.getNextInput(input)) || $(input).nextAll('input')[0] as HTMLInputElement;
                    if (!next || next === input) return;

                    next.focus();
                    util.setCaretPosition(next, 0);
                }
            }
        }
    }));
}