import * as AST from './ast/index';
import {Types} from './ast/index';
import * as _ from 'underscore';

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
                    identifier: AST.createIdentifier('myVar1'),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                } as AST.DeclarationNode,

                {
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: AST.createIdentifier('myVar2'),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                } as AST.DeclarationNode,

                {
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: AST.createIdentifier('myVar3'),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                } as AST.DeclarationNode,
            ],
            identifier: AST.createIdentifier('main'),
            type: AST.CodeNodeTypes.module,
            _parent: null ,
            version: '0.0.1'
        };
        openPrograms[this.data._id] = this;
    }

    private nextId: number = 0;
    getNextId() {
        return (++this.nextId).toString();
    }

    static programFromNode(node: AST.CodeNode) : Program {
        if (node._parent) {
            return Program.programFromNode(node._parent);
        }
        return openPrograms[node._id];
    }
}

export function programToJSON(program: Program) : string {
    return JSON.stringify(program.data, (key, val) => {
        if (key.startsWith('_')) return undefined;
        return val;
    }, 2);
}

export function programFromJSON(json: string) : Program {
    const program = new Program();
    const parsed = JSON.parse(json);

    const reviveChildren = (object: AST.CodeNode) => {
        _.values(object).forEach(val => {

            if (typeof(val) === 'object' && val.type) {
                // Assume we've revived a code node
                // Add id and parent
                val._id = program.getNextId();
                reviveChildren(val);
                // Order is important here, can't add parent to children before
                // reviving them, because then we have a circular reference
                val.parent = object;
            }
        });
    };

    reviveChildren(parsed);
    program.data = parsed;
    return program;
} 

export function programToLLVM(program: Program) : string {
    return ''; // TODO: ;)
}

export function programToRust(program: Program) : string {
    return ''; // TODO: ;)
}

export {AST};