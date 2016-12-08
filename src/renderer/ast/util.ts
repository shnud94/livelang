import * as AST from './index';

export function nearestModule(node: AST.Nodes) : AST.ModuleNode {
    if (node) {
        if (node.type !== 'module') return nearestModule(node._parent);
        else return node;
    }

    return null;
}