import * as program from '../program';
import {AST, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import * as utils from '../util/index';
import {Result} from '../util/index';
import {EventSource} from '../util/events';
import * as Frontend from '../frontend/index';
import {NodeTextDescription, NodeTextComponent, NodeTextSpec} from '../frontend/index';
import * as js from '../frontend/javascriptStyle';
import {NodeEvents, NodeTextController, ComponentDescription} from './index';
import * as parserCustom from '../parser/custom';
import * as nearley from '../parser/nearley';
import {DOMData} from './programView';
import * as _ from 'underscore';
import * as Nearley from 'nearley';

const createBaseComponentControllerEvents = () : NodeEvents => {
    return {
        nodeChanged: new EventSource<{id?: string}>(),
        nodeChildInserted: new EventSource<{index: number}>(),
        nodeChildRemoved: new EventSource<{index: number}>()
    }
}

/**
 * Resuable general controller for all nodes
 */
export const basicController = (node: AST.CodeNode) : NodeTextController => {
    
    const nodeDescription = js.frontendDescription.descriptorForNode(node);
    
    // See these more as pointers to the beginning of components, not necessarily the whole component, could be a list
    // of many
    let startComponentNodesByIndex: {[key: number] : HTMLElement} = {};

    let thisController: NodeTextController = {
        node: node,
        events: createBaseComponentControllerEvents(),
        handleComponentChange: (newValue) => {
            node = newValue as any;
            return {
                errors: [],
                success: true,
                completions: []
            }
        },
        handleChildComponentChange: (indexes, newComponent) => {
            const currentComponents = nodeDescription.componentsFromNode(node);
            currentComponents[indexes[0]] = newComponent;
            nodeDescription.updateNodeFromComponents(currentComponents, node);
            
            return {
                errors: [],
                success: true,
                completions: []
            }
        },
        render(parent: HTMLElement) {

            const processDescription = (desc: NodeTextComponent, index: number, array: NodeTextComponent[], indexInArray: number) => {
                
                if (desc == null) {
                    desc = '';
                }

                if (typeof(desc) === 'string') {
                    const asString = desc as string;
                    const domNode = $('<span>')
                        .addClass('node')
                        .attr('contentEditable', 'true')
                        .data({
                            representedNode: node,
                            componentController: thisController,
                            index: index
                        } as DOMData)
                        .text(asString).appendTo(parent);

                    startComponentNodesByIndex[index] = domNode[0];
                }
                else if (Array.isArray(desc)) {
                    const asArray = desc as NodeTextComponent[];
                    asArray.forEach((each, index) => processDescription(each, index, array, indexInArray));
                }
                else {
                    // Assume it's a node, grab its controller and render afterwards
                    const asNode = desc as AST.CodeNode;
                    const controllerForChildNode = basicController(asNode);
                    controllerForChildNode.parentController = thisController;
                    controllerForChildNode.render(parent);
                    controllerForChildNode.indexInParent = index;
                    controllerForChildNode.indexInArray = indexInArray;
                }
            };
            
            nodeDescription.componentsFromNode(node).forEach((component, index, array) => {

                const asArray = utils.forceArray(component);
                asArray.forEach((component, indexInArray) => {
                    processDescription(component, index, array, indexInArray);
                })                
            });
        },
        description: nodeDescription
    }

    return thisController;
}