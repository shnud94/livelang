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

const verifyAgainstTextSpec = (input: string, spec: NodeTextSpec, parent: NodeTextDescription<any>) : Result<any> => {

    const grammar = parserCustom.generateNearleyGrammarFromTextSpec('rule', spec);
    const compiled = nearley.compileGrammar(grammar);
    if (!compiled.result) {
        return compiled.error;
    }

    const parseResult = nearley.parse(compiled.result, input);
    if (parseResult.result) {
        return {
            result: _.flatten(parseResult.result).join('')
        };
    }
    else {
        return {
            error: parseResult.error
        }
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

    let controller = {
        events: createBaseComponentControllerEvents(),
        handleComponentChange: (index) => {
            
            // go to the parser, check the input is valid for this component
            const newComponentText = $(startComponentNodesByIndex[index]).text();
            const result = verifyAgainstTextSpec(newComponentText, nodeDescription.getTextSpecs()[index], nodeDescription);

            // if invalid, return errors
            if (result.error) {
                return {
                    errors: [result.error],
                    success: false,
                    completions: []
                }
            }

            const currentComponents = nodeDescription.componentsFromNode(node);
            currentComponents[index] = result.result;
            nodeDescription.updateNodeFromComponents(currentComponents, node);
            
            return {
                errors: [],
                success: true,
                completions: []
            }
        },
        render(parent: HTMLElement) {

            const processDescription = (controller: NodeTextController, desc: NodeTextComponent, index: number, array: NodeTextComponent[]) => {
                
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
                            componentController: controller,
                            index: index
                        } as DOMData)
                        .text(asString).appendTo(parent);

                    startComponentNodesByIndex[index] = domNode[0];
                }
                else {
                    // Assume it's a node, grab its controller and render afterwards
                    const asNode = desc as AST.CodeNode;
                    const controllerForChildNode = basicController(asNode);
                    controllerForChildNode.parent = this;
                    controllerForChildNode.render(parent);
                }
            };
            
            nodeDescription.componentsFromNode(node).forEach((component, index, array) => {

                const asArray = utils.forceArray(component);
                asArray.forEach(component => {
                    processDescription(controller, component, index, array);
                })                
            });
        },
        description: nodeDescription
    }

    return controller;
}