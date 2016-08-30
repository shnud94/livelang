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
import {RenderResult, RenderContext, NodeEvents, NodeTextController, ComponentDescription} from './index';
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
export const basicController = (node: AST.CodeNode, parent?: NodeTextController) : NodeTextController => {
    
    const nodeDescription = js.frontendDescription.descriptorForNode(node);
    
    // See these more as pointers to the beginning of components, not necessarily the whole component, could be a list
    // of many
    let startComponentNodesByIndex: {[key: number] : HTMLElement} = {};
    const failureResponse = {errors: [], success: false, completions: []};

    let thisController: NodeTextController = {
        parentController: parent,
        firstNode: null,
        node: node,
        events: createBaseComponentControllerEvents(),
        handleComponentChange: (newValue, source) => {
            if (nodeDescription.denyReparse) return failureResponse;
        
            const whitespace = /\s*/.exec(source)[0];
            _.keys(newValue).forEach(key => {
                if (key.startsWith('_')) delete newValue[key];
            });
            _.extend(node, newValue);
            node.display = node.display || {};
            node.display.whitespace = whitespace;

            console.log('whitespace: ' + whitespace);
            console.log('length: ' + whitespace.length);
            return {
                errors: [],
                success: true,
                completions: []
            }
        },
        render() : RenderResult {
            let components: TextComponent[] = [];
            if (node.display && typeof(node.display.whitespace) === 'string') {
                components.push(node.display.whitespace);
            }

            const processDescription = (desc: TextComponent) => {
                if (!desc) return;

                if (Array.isArray(desc)) {
                    const asArray = desc as TextComponent[];
                    asArray.forEach(processDescription);
                }
                else {
                    components.push(desc);
                }
            };
            
            nodeDescription.componentsFromValue(node).forEach((component, index, array) => {
                const asArray = utils.forceArray(component);
                asArray.forEach((component, indexInArray) => {
                    processDescription(component);
                });                
            });

            return {
                renderables: components.map(component => {
                    return {
                        component: component,
                        options: {}
                    }
                })
            }
        },
        description: nodeDescription
    }

    return thisController;
}