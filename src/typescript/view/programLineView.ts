import * as AST from '../ast/index';
import * as ASTUtil from '../ast/util';
import * as NodeController from './nodeController';
import * as LineView from './lineView';
import * as index from './index';
import * as parser from '../parser/custom';
import * as interpreter from '../interpreter/index';

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
                        console.log(contextAfterRun);
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
            parts.push({content: renderable.component, data, id: controller.node._id});
        }
        else {
            // Must be a node
            parts = parts.concat(elementsFromController(NodeController.basicController(renderable.component as AST.Nodes, controller)));
        }
    });

    return parts;
}