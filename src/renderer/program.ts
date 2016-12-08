import * as AST from './ast/index';
import * as Types from './ast/index';
import * as _ from 'underscore';

let lastId = Number.MIN_SAFE_INTEGER;
export function nextId() : string {
    return (++lastId).toString();
}

export function createNode(node: any) : any { 
    (node as any)._id = nextId();
    return node;
}

let openPrograms: {[key: string] : Program} = {};
export class Program {

    modules: AST.ModuleNode[] = [];
    
    constructor() {
        this.modules.push(createNode({
            children: [

                createNode({
                    type: 'declaration',
                    flags: new Set(),
                    identifier: createNode(AST.createIdentifier('myVar1')),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                }) as AST.DeclarationNode,

                createNode({
                    type: 'declaration',
                    flags: new Set(),
                    identifier: createNode(AST.createIdentifier('myVar2')),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                }) as AST.DeclarationNode,

                {
                    type: 'declaration',
                    flags: new Set(),
                    identifier: createNode(AST.createIdentifier('myVar3')),
                    valueExpression: null,
                    typeExpression: null,
                    _parent: null
                } as AST.DeclarationNode,
            ],
            identifier: AST.createIdentifier('main'),
            type: 'module',
            _parent: null ,
            version: '0.0.1'
        }));
        
        // TODO: Look into this and its consequences
        reviveNode(this.modules[0], null);
        openPrograms[this.modules[0]._id] = this;
    }

    static programFromNode(node: AST.CodeNode) : Program {
        if (node._parent) {
            return Program.programFromNode(node._parent);
        }
        return openPrograms[node._id];
    }
}

export function nodeToJSON(program: AST.Nodes) : string {
    return JSON.stringify(program, (key, val) => {
        if (key.startsWith('_')) return undefined;
        return val;
    }, 2);
}

export function programToJSON(program: Program) : string {
    return JSON.stringify(_.pick(program, 'modules'), (key, val) => {
        if (key.startsWith('_')) return undefined;
        return val;
    }, 2);
}

export const reviveNode = (val: any, parent: AST.CodeNode = null) => {
    if (Array.isArray(val)) {
        val.forEach(val => reviveNode(val, parent));
    }
    else if (val.type) {
        // Assume we've revived a code node
        // Add id and parent
        // Keep existing ID if possible
        if (!val._id) val._id = nextId();
        
        val._parent = null;
        reviveChildren(val);
        // Order is important here, can't add parent to children before
        // reviving them, because then we have a circular reference
        if (!val) debugger;
        val._parent = parent;
    }
};

export const reviveChildren = (object: AST.CodeNode) => {
    _.keys(object).filter(k => !k.startsWith('_')).forEach(key => {
        const val = object[key];
        if (val && typeof(val) === 'object') {
            reviveNode(val, object);        
        }
    });
};

export function programFromJSON(json: string) : Program {
    const program = new Program();
    const parsed = JSON.parse(json);
    parsed.modules.forEach(reviveNode);
    program.modules = parsed.modules;
    return program;
} 

export function programToLLVM(program: Program) : string {
    return ''; // TODO: ;)
}

export function programToRust(program: Program) : string {
    return ''; // TODO: ;)
}

export {AST};