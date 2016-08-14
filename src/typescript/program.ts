import * as AST from './ast/index';
import {Types} from './ast/index';

let openPrograms: {[key: string] : Program} = {};
export class Program {

    data: AST.ModuleNode;
    constructor() {


        this.data = {
            _id: this.getNextId(),
            children: [

                {
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: 'myVar',
                    valueExpression: null,
                    typeExpression: null,
                    parent: null
                } as AST.DeclarationNode,

                {
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: 'myOtherVar',
                    valueExpression: null,
                    typeExpression: null,
                    parent: null
                } as AST.DeclarationNode,

                {
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: 'hereTakeMyLastVar',
                    valueExpression: null,
                    typeExpression: null,
                    parent: null
                } as AST.DeclarationNode,
            ],
            identifier: 'main',
            type: AST.CodeNodeTypes.module,
            parent: null ,
            version: '0.0.1'
        };
        openPrograms[this.data._id] = this;
    }

    private nextId: number = 0;
    getNextId() {
        return (++this.nextId).toString();
    }

    static programFromNode(node: AST.CodeNode) : Program {
        if (node.parent) {
            return Program.programFromNode(node.parent);
        }
        return openPrograms[node._id];
    }
}

export function programToJSON(program: Program) : string {
    return JSON.stringify(program.data);
}

export function programFromJSON(json: string) : Program {
    return JSON.parse(json);
} 

export function programToLLVM(program: Program) : string {
    return ''; // TODO: ;)
}

export function programToRust(program: Program) : string {
    return ''; // TODO: ;)
}

export {AST};