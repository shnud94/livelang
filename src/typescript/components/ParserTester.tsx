import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from '../program';
import {AST, Helpers, Program} from '../program';
import {LineLikeProps, LineLikeCallbacks, wrapLineLike, NodeProps} from './index';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as types from '../types/index';
import * as util from '../view/util';
import 'fuzzyset.js';

interface NodeCollectionProps {
    nodes: AST.CodeNode[]
}
export class NodeCollection extends React.Component<NodeCollectionProps, any> {
    
    render() : JSX.Element {
        return <div>{this.props.nodes.map(node => {

            if (node.type === AST.CodeNodeTypes.func) {
                return functionComponent(node as AST.FunctionNode);
            }
            else if (node.type === AST.CodeNodeTypes.module) {
                return moduleComponent(node as AST.ModuleNode);    
            }
            else {
                return 'unsupported';
            }         
        })}</div>;
    }
}

interface CodeNodeComponentOptions {
    getChildren: () => JSX.Element[]
}
class CodeNodeComponent extends React.Component<any, any> {

    constructor(private options: CodeNodeComponentOptions) {
        super();
    }

    render() : JSX.Element {
        // Do some stuff here to handle layout
        return <div>{this.options.getChildren()}</div>;
    }
}

const createCodeNodeComponent = (options: CodeNodeComponentOptions) => React.createElement(CodeNodeComponent, options);
/**
 * An element that can't be edited but still shows inline with the source, just gets skipped past
 */
function createGhostElement(content: string) : React.ReactElement<any> {
    return React.createElement('span', {
        children: [content] 
    });
}

function createStringElement<T extends AST.CodeNode>(node: T, getter: (node: T) => string, setter: (value: string) => void) : React.ReactElement<any> {
    return <StringComponent value={getter(node)} />;
}

function createChildrenElement<T extends AST.CodeNode>(nodes: T[]) : React.ReactElement<any> {
    return <NodeCollection nodes={nodes} />;
}

const moduleComponent = (node: AST.ModuleNode) => createCodeNodeComponent({
    getChildren: () => {
        return [
            createStringElement(node, node => node.type, value => node.type = value),
            createStringElement(node, node => node.identifier, value => node.identifier = value),
            createGhostElement('{'),
            createChildrenElement(node.children),
            createGhostElement('}')
        ].map((e, index) => _.extend({}, e, {key: index}));
    }
});

const functionComponent = (node: AST.FunctionNode) => createCodeNodeComponent({
    getChildren: () => {
        return [
            createGhostElement('function'),
            createStringElement(node, node => node.identifier, value => node.identifier = value),
            createGhostElement('('),
            // TODO: Arguments
            createGhostElement(')'),
            createGhostElement('{'),
            createChildrenElement(node.children),
            createGhostElement('}')
        ].map((e, index) => _.extend({}, e, {key: index}));
    }
});

(input: string, 
allowedChildTypes: AST.CodeNodeType[], 
furtherVerification: (type: AST.CodeNodeType, input: string) => boolean, 
getInsertionNode: (prev: any, next: any) => AST.CodeNode) => {

}

interface NodeComponentProps<T extends AST.CodeNode> {
    
    /**
     * This is so that this node component has the ability to insert nodes before and after this node, as we use each
     * node components input as the primary interface to recieve keys
     */
    location: {
        siblings: Node
        index: number
    }
    
    stringRep: string

    parentComponent: NodeCollection
}
interface NodeComponentState {
    completion?: {
        updater: () => void
        stringRep: string,
        node: AST.CodeNode
    }
}
export class NodeComponent<T extends AST.CodeNode> extends React.Component<NodeComponentProps<T>, NodeComponentState> {

    constructor(props: any) {
        super(props);
        this.state = {
            completion: null
        };
    }

    render() : JSX.Element {
        const completion = this.state.completion || '';
        const onKeyUp = (event: KeyboardEvent) => {
            
            if (event.keyCode === 27) { // Escape
                this.setState(s => s.completion = null);
                return;
            }

            if (event.keyCode === 13) { // Return
                if (this.state.completion) {
                    this.state.completion.updater();
                    this.setState(s => s.completion = null);
                }
                return;                
            }

            const value = $(event.currentTarget).text();
            // const parseResult = parser.parseInModule({
            //     content: value,
            //     position: 0
            // });

            this.setState(s => {
                // if (parseResult.result) {
                    
                //     // s.completion = {
                //     //     stringRep: '',
                //     //     node: parseResult.result,
                //     //     updater: () => {
                //     //         _.keys(this.props.node).filter(k => !k.startsWith('_')).forEach(k => {
                //     //             delete (this.props.node as any)[k];
                //     //         });
                //     //         _.keys(parseResult.result).filter(k => !k.startsWith('_')).forEach(k => {
                //     //             (this.props.node as any)[k] = (parseResult.result as any)[k];
                //     //         });
                //     //     }
                //     // };
                // }     

                // s.completion = null;
            });
        };

        return <div><StringComponent onKeyUp={onKeyUp} value={this.props.stringRep} /><span>{completion}</span></div>;
    }
}

interface StringComponentProps {
    value: string,
    onKeyUp?: (event: KeyboardEvent) => void
}
export class StringComponent extends React.Component<StringComponentProps, any> {
    render() : JSX.Element {
        return <span onKeyUp={this.props.onKeyUp || (() => {})} contentEditable={true}>{this.props.value}</span>;
    }
}