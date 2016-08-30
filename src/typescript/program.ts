import * as AST from './ast/index';
import {Types} from './ast/index';
import * as _ from 'underscore';

let lastId = Number.MIN_SAFE_INTEGER;
export function nextId() : string {
    return (++lastId).toString();
}

export function createNode<T extends AST.CodeNode>(node: T) : T { 
    node._id = nextId();
    return node;
}

let openPrograms: {[key: string] : Program} = {};
export class Program {

    data: AST.ModuleNode;
    constructor() {
        this.data = createNode({
            children: [

                createNode({
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: createNode(AST.createIdentifier('myVar1')),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                }) as AST.DeclarationNode,

                createNode({
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: createNode(AST.createIdentifier('myVar2')),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                }) as AST.DeclarationNode,

                {
                    type: AST.CodeNodeTypes.declaration,
                    mutable: true,
                    identifier: createNode(AST.createIdentifier('myVar3')),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                } as AST.DeclarationNode,
            ],
            identifier: AST.createIdentifier('main'),
            type: AST.CodeNodeTypes.module,
            _parent: null ,
            version: '0.0.1'
        });
        openPrograms[this.data._id] = this;
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
                val._id = nextId();
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