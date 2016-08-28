import * as program from '../program';
import {AST, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import * as utils from '../util/index';
import {Result} from '../util/index';
import {EventSource} from '../util/events';
import * as Frontend from '../frontend/index';
import {NodeTextDescription, TextComponent, TextSpec} from '../frontend/index';
import * as js from '../frontend/javascriptStyle';
import {RenderContext, NodeEvents, NodeTextController, ComponentDescription} from './index';
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
    const failureResponse = {errors: [], success: false, completions: []};

    let thisController: NodeTextController = {
        firstNode: null,
        node: node,
        events: createBaseComponentControllerEvents(),
        handleComponentChange: (newValue) => {
            if (nodeDescription.denyReparse) return failureResponse;
        
            _.keys(node).forEach(key => {
                if (!key.startsWith('_')) delete node[key];
            });
            _.extend(node, newValue);

            return {
                errors: [],
                success: true,
                completions: []
            }
        },
        handleChildComponentChange: (indexes, newComponent) => {
            if (nodeDescription.denyReparse) return failureResponse;

            const currentComponents = nodeDescription.componentsFromValue(node);
            currentComponents[indexes[0]] = newComponent;
            const result = nodeDescription.updateValueFromComponents(currentComponents, node);
            if (result !== node) {
                console.error('You are expected to only update an existing node, not return a new one');
            }
            
            return {
                errors: [],
                success: true,
                completions: []
            }
        },
        render(context: RenderContext) {

            thisController.firstNode = null;
            const insert = (toInsert: HTMLElement) => {
                if (!context.head) {
                    $(toInsert).appendTo(context.parent);
                }
                else {
                    $(toInsert).insertAfter(context.head);
                }
                context.head = toInsert[0];

                if (!thisController.firstNode) {
                    thisController.firstNode = toInsert;
                }
            }

            const processDescription = (desc: TextComponent, index: number, array: TextComponent[], indexInArray: number) => {
                
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
                            index: index,
                            initial: asString
                        } as DOMData)
                        .text(asString);
                    insert(domNode[0]);

                    startComponentNodesByIndex[index] = domNode[0];
                }
                else if (Array.isArray(desc)) {
                    const asArray = desc as TextComponent[];
                    asArray.forEach((each, index) => processDescription(each, index, array, indexInArray));
                }
                else {
                    // Assume it's a node, grab its controller and render afterwards
                    const asNode = desc as AST.CodeNode;
                    const controllerForChildNode = basicController(asNode);
                    controllerForChildNode.parentController = thisController;
                    controllerForChildNode.render(context);
                    controllerForChildNode.indexInParent = index;
                    controllerForChildNode.indexInArray = indexInArray;
                }
            };
            
            nodeDescription.componentsFromValue(node).forEach((component, index, array) => {

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