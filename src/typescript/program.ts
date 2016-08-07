import * as AST from './ast/index';
import {Helpers, Types} from './ast/index';

let openPrograms: {[key: string] : Program} = {};
export class Program {

    data: AST.ModuleNode;
    constructor() {
        this.data = {
            _id: this.getNextId(),
            children: [],
            identifier: 'main',
            type: AST.CodeNodeTypes.module,
            parent: null ,
            version: '0.0.1',
            shortName: 'main'
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

    createEmptyNode(parent: AST.CodeNode) : AST.CodeNode {
        return {
            _id: this.getNextId(),
            type: AST.CodeNodeTypes.noop,
            parent: parent
        };
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

export {AST, Helpers};