import * as AST from '../ast/index';
import * as ASTUtil from '../ast/util';
import * as NodeController from './nodeController';
import * as LineView from './lineView';
import * as index from './index';
import * as parser from '../parser/custom';
import * as interpreter from '../interpreter/index';
import * as checker from '../types/checker';
import * as types from '../types/index';
import * as _ from 'underscore';

interface ProgramLineElementData {
    controller: index.NodeTextController
}

export function create(program: AST.Nodes, container: HTMLElement) {

    const rootController = NodeController.basicController(program, null);
    const lineView = LineView.create(container, {
        onElementChange(value, previous, data) {}
    }, () => elementsFromController(rootController))

    $(container).keyup(event => {
        if (!event.ctrlKey || event.keyCode !== 13) {
            return;
        }
        else {
            event.preventDefault();
            const text = lineView.getAllText();
            const wholeParseResult = parser.parseSpecCached(rootController.description, lineView.getAllText(), rootController.description.id);

            if (wholeParseResult.result) {
                const changeResult = rootController.handleComponentChange(wholeParseResult.result, text);
                if (changeResult.success) {
                    lineView.renderAll();
                    
                    const module = ASTUtil.nearestModule(program);
                    if (!module) debugger;
                    else {
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
                            const idsByLine: {[line: number] : id[]} = {};

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
                                    {type: 'lineStart'}
                                );

                                return accum;
                            }, {});

                            console.log(forEachLine);
                        }
                    }
                }
            }  
        }
    })

    return {
        lineView
    }
}

type ElementType = LineView.LineElement<ProgramLineElementData>;
const elementsFromController = (controller: index.NodeTextController) : ElementType[] => {

    let result = controller.render();
    let parts: ElementType[] = [];
    controller.firstNode = null;
    const data: ProgramLineElementData = {
        controller: controller
    }

    result.renderables.forEach(renderable => {
        if (typeof(renderable.component) === 'string') {
            parts.push({content: renderable.component, data, ids: [controller.node._id]});
        }
        else {
            // Must be a node

            const nodeParts = elementsFromController(NodeController.basicController(renderable.component as AST.Nodes, controller));
            parts = parts.concat(nodeParts.map(part => {
                part.ids.push(controller.node._id); // Add the parent id as well
                return part;
            }));
        }
    });

    return parts;
}