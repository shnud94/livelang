import * as project from './project'
import * as _ from 'underscore'
import * as style from '../frontend/javascriptStyle'
import * as parser from '../parser/custom';
import * as AST from '../AST/index';
import * as checker from '../types/checker';

type FunctionInvocationRecorder = (node: AST.CallExpressionNode) => FunctionInvocationRecorder

interface JSEmitOptions {
    /**
     * Pass something in that will track invoked function in the emitted code and do something with it,
     * various recording functions should be prebuilt
     */
    recordFunctionInvocations?: (node: AST.CallExpressionNode) => FunctionInvocationRecorder

}


function emitJs(project: project.LiveLangProject, emitOptions: JSEmitOptions) {

    const modules = project.getAllModules();
    const parsed = modules.map(module => parser.parseSpecCached(style.theModule, module._savedContent, style.theModule.id));
    const results: AST.ModuleNode[] = parsed.map(p => {
        if (p.error) {
            console.error(p.error);
        }
        return p.result;
    });

    function processModule(module: AST.ModuleNode) {
        

        
    }

    const main = results.find(r => r.identifier.value === 'main');
    if (!main) {
        console.error('No main module');
    }


}