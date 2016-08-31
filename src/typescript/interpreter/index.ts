import * as AST from '../ast/index';
import * as Types from '../types/index';

function runModule(mod: AST.ModuleNode) {

    interface RunTime {
        value: any,
        type: Types.Type
    }

    interface Stack {
        declared: {[key: string] : RunTime}
    }

    const stacks: Stack[] = [{
        declared: {}
    }];
    let currentStack = stacks.last();

    mod.children.forEach(child => {


        
    });
}

// export const createContext = () => {

//     const scope = {};
//     const callStack: any[] = [];
//     const types = {};

//     const context: {[key: string]: any} = {

//         interpretNode(node: AST.CodeNode) {
//             if (context[node.type] as any) {
//                 context[node.type](node);
//             }
//         },

//         [AST.CodeNodeTypes.typeDeclaration] : (node: AST.ModuleNode) => {

//         },

//         [AST.CodeNodeTypes.module] : (node: AST.ModuleNode) => {

//         },

//         [AST.CodeNodeTypes.importt] : (node: AST.ImportNode) => {

//         },

//         [AST.CodeNodeTypes.func] : (node: AST.ModuleNode) => {

//         },

//         [AST.CodeNodeTypes.declaration] : (node: AST.DeclarationNode) => {
//             scope
//         },

//         run(module: AST.ModuleNode) {

//         }
//     };

//     return context;
// }

