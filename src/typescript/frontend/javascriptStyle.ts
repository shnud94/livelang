import * as program from '../program';
import {AST, Program} from '../program';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as types from '../types/index';
import 'fuzzyset.js';
import * as index from './index';
import {NodeTextController} from '../view/index';
import * as View from '../view/index';
import {TextDescription, NodeTextDescription, TextSpec} from './index';

const frontendId = 'javascript';
const flat = (something: any) => {
    if (Array.isArray(something)) {
        const flattened = _.flatten(something);
        if (flattened.every(e => typeof(e) === 'string')) {
            return flattened.join('');
        }
        return flattened.length === 1 ? flattened[0] : flattened;
    }
    return something;
}
const flatten = (something: any) => {
    if (Array.isArray(something)) {
        const flattened = _.flatten(something);
        if (flattened.every(e => typeof(e) === 'string')) {
            return flattened.join('');
        }
        return flattened;
    }
    return something;
}
const assignParent = <T extends AST.CodeNode>(node: T, parent) : T => {
    if (typeof(node) !== 'object') return;
    node._parent = parent; return node;
}

export const frontendDescription = {
    descriptorForNode<T extends AST.CodeNode>(node: T) : NodeTextDescription<T> {
        return nodeTextualDescriptorForType(node.type) as NodeTextDescription<T>;
    }   
};

function optionally(spec: TextSpec) : TextSpec {
    return {'?' : spec};
}
function delimited(spec: TextSpec, delimiter: string) : TextSpec {
    return {all: [
        spec,
        {'*' : {all: [delimiter, __, spec]}}
    ]};
}
function commaSeparated(spec: TextSpec) : TextSpec {
    return delimited(spec, ',');
}

const identifier = {all: [
    {charset: 'a-zA-Z'},
    {'*' : {charset: 'a-zA-Z0-9_-'}}
]};
const __ = {'*': {charset: ' \xA0\\t\\n\\v\\f'}};
const ___ = {'+': {charset: ' \xA0\\t\\n\\v\\f'}};

function nodeTextualDescriptorForType(type: AST.CodeNodeType) : NodeTextDescription<any> {
    return descriptors[type] as any; 
}

export const numericLiteral: NodeTextDescription<AST.NumericLiteralNode> = {
    id: AST.CodeNodeTypes.numericLiteral,
    updateValueFromComponents: (components, prev) => {
        const value = parseFloat(flat(components));
        return {
            type: AST.CodeNodeTypes.numericLiteral,
            value: value,
            _parent: prev ? prev._parent : null
        }
    },
    getTextSpecs() {
        return [
            {or: [
                {'+' : {charset: '0-9'}},    
                {all: [
                        {'*' : {charset: '0-9'}},
                        {all: ['.', {'+' : {charset: '0-9'}}]}
                    ]
                },    
            ]}
        ]
    },
    componentsFromValue: node => {
        return [node.value.toString()]
    }
}

export const stringLiteral: NodeTextDescription<AST.StringLiteralNode> = {
    id: AST.CodeNodeTypes.stringLiteral,
    updateValueFromComponents: (components, prev) => {
        const value = flat(components);
        return {
            type: AST.CodeNodeTypes.stringLiteral,
            value: value.substr(1, value.length - 2),
            _parent: prev ? prev._parent : null
        }
    },
    getTextSpecs() {
        return [
            '"',
            {'*':{charset: '^"'}},
            '"'
        ]
    },
    componentsFromValue: node => {
        return ['"' + node.value.toString() + '"']
    }
}

const objectField = () => ({all: [expression, ':', expression]});

export const mapLiteral: NodeTextDescription<AST.MapLiteralNode> = {
    id: AST.CodeNodeTypes.mapLiteral,
    updateValueFromComponents: (components, prev) => {
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.mapLiteral,
                value: null,
                _parent: prev ? prev._parent : null
            }
        }

        prev.value = flat(components);
        return prev;
    },
    getTextSpecs() {
        return [
            '{',
            optionally(commaSeparated(objectField())), 
            '}'
        ]
    },
    componentsFromValue: node => {
        return [
            '{',
            node.value.toString(),
            '}'
        ]
    }
}

export const prefixExpression: NodeTextDescription<AST.CallExpressionNode> = {
    id: 'prefixExpression',
    updateValueFromComponents: (components, prev) => {

        if (!prev) {
            prev = {
                _parent: null,
                target: null,
                input: null,
                type: AST.CodeNodeTypes.callExpression
            }
        }

        const valid = {'!':true,'-':true};
        let operator = flat(components[0]) as string;
        if (!valid[operator]) {
            console.error('Invalid operator for prefix expression')
            prev.target = prev.target || '!';
        }
        else {
            prev.target = operator
        }
        
        prev.input = assignParent(flat(components[1]) as any, prev);
        return prev;
    },
    getTextSpecs: () => [
        {charset: "-!"},
        expression
    ],
    componentsFromValue: node => [
        node.target, 
        node.input
    ]
}

export const arrayLiteral: NodeTextDescription<AST.ArrayLiteralNode> = {
    id: AST.CodeNodeTypes.arrayLiteral,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                _parent: null,
                value: null,
                type: AST.CodeNodeTypes.arrayLiteral
            }
        }

        const elements = flatten(components[1]).filter(el => typeof(el) === 'object') as AST.ExpressionType[]; 
        prev.value = elements.map(e => assignParent(e as any, prev));
        return prev;
    },
    getTextSpecs() {
        return [
            '[',
            optionally(commaSeparated(expression)),            
            ']'
        ]
    },
    componentsFromValue: node => {
        return [
            '[',
            flatten(node.value.map((value, index, array) => {
               if (index > 0) {
                return [', ', value] as any
               } 
               else {
                   return [value] as any
               }
            })),
            ']'
        ]
    }
}

export const memberAccessExpression: NodeTextDescription<AST.MemberAccessExpression> = {
    id: AST.CodeNodeTypes.memberAccess,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                _parent: null,
                subject: null,
                member: null,
                type: AST.CodeNodeTypes.memberAccess
            }
        }

        prev.subject = flat(components[0]) as AST.ExpressionType;
        prev.member = flat(components[2]) as string;

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        '\.',
        identifier     
    ]),
    componentsFromValue: node => [
        node.subject,
        '.',
        node.member
    ]
}

export const callExpression: NodeTextDescription<AST.CallExpressionNode> = {
    id: AST.CodeNodeTypes.callExpression,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                _parent: null,
                input: null,
                target: null,
                type: AST.CodeNodeTypes.callExpression
            }
        }

        prev.target = flat(components[0]) as AST.ExpressionType;
        prev.input = flat(components[1])[1] as AST.ExpressionType;

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        {all: ['(', {'?': expression}, ')']}        
    ]),
    componentsFromValue: node => [
        node.target,
        '(', 
        node.input ? node.input : '',
        ')'
    ]
}

export const binaryExpression: NodeTextDescription<AST.CallExpressionNode> = (() => {
    const valid = ['*', '/', '+', '-', '>', '<', '>=', '<=', '==', '!=', '&&', '||'];
    
    return {
        id: 'binaryExpression',
        updateValueFromComponents: (components, prev) => {
            if (!prev) {
                prev = {
                    type: AST.CodeNodeTypes.callExpression,
                    _parent: null,
                    target: null,
                    input: null
                }
            }

            prev.target = flat(components[2]) as string;
            prev.input = AST.createArrayLiteral([flat(components[0]) as any, flat(components[4]) as any]);
            return prev;
        },
        getTextSpecs: () => ([
            expression,
            __,
            {or: valid},
            __,
            expression
        ]),
        componentsFromValue: node => [
            node.lhs, 
            ' ',
            node.operator,
            ' ',
            node.rhs
        ]
    }
})();

export const expression = {or: [
    identifier,
    numericLiteral,
    stringLiteral,
    arrayLiteral,
    binaryExpression,    
    prefixExpression,    
    memberAccessExpression,
    callExpression,    
]}

export const assignment: NodeTextDescription<AST.AssignmentNode> = {
    id: AST.CodeNodeTypes.assignment,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.assignment,
                _parent: null,
                identifier: null,
                valueExpression: null
            };
        }

        prev.identifier = flat(components[0]) as string;
        prev.valueExpression = assignParent(flat(components[4]) as any, prev);
        
        return prev;
    },
    getTextSpecs: () => [
        identifier,
        __,
        '=',
        __,
        expression
    ],
    componentsFromValue: node => [
        node.identifier,
        ' ',
        '=',
        ' ',
        node.valueExpression
    ]
};

export const declaration: NodeTextDescription<AST.DeclarationNode> = {
    id: AST.CodeNodeTypes.declaration,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.declaration,
                _parent: null, // TODO: How are we going to make sure parent isn't null when first creating a node?
                mutable: null,
                identifier: null,
                valueExpression: null,
                typeExpression: null
            };
        }

        prev.mutable = (flat(components[0]) || '').trim() === 'var';
        prev.identifier = flat(components[2]) as string;
        
        const maybeTypeExpression = (flat(components[4]) || []) [2] as any;
        if (maybeTypeExpression) {
            prev.typeExpression = assignParent(maybeTypeExpression, prev);
        }

        const maybeValueExpression = (flat(components[6]) || []) [2] as any;
        if (maybeValueExpression) {
            prev.valueExpression = assignParent(maybeValueExpression, prev);
        }
        
        return prev;
    },
    getTextSpecs: () => [
        {or: ['let', 'var']},
        ___,
        identifier,
        __,
        {'?': {all: [':', __, expression]}}, // Type expression,
        __,
        {'?': {all: ['=', __, expression]}}, // Initial assignment
    ],
    displayOptions: () => [null, null, null, null, null, null, null],
    componentsFromValue: node => [
        node.mutable ? 'var' : 'let',
        ' ',
        node.identifier,
        (node.typeExpression || node.valueExpression) ? ' ' : '',
        node.typeExpression ? [': ', node.typeExpression] : null,
        node.typeExpression ? ' ' : '',
        node.valueExpression ? ['= ', node.valueExpression] : null,
    ]
};

export const theModule: NodeTextDescription<AST.ModuleNode> = {
    id: AST.CodeNodeTypes.module,
    getTextSpecs: () => [
        'module', // 0
        ___,
        identifier, // 2
        ___,
        '{', // 4,
        __,
        {'*': {all: [ // 6
            {or: [assignment, expression, declaration]},
            __,  
            ';',
            __
        ]}},
        __,
        '}' // 8
    ],
    displayOptions() {
        return [null, null, null, null, null, null, null, {breaksLine: true, tabsNextLine: -1}, null]
    },
    updateValueFromComponents: (components, prev) => {
        let node = prev;
        if (!node) {
            node = {
                type: AST.CodeNodeTypes.module,
                _parent: null,
                identifier: null,
                version: '0.0.1', // TODO: Get the latest version that we're on right now
                children: null
            };
        }

        node.children = (flat(components[6]) as Array<any>).filter(child => typeof(child) !== 'string');
        node.identifier = flat(components[2]) as string;
        return node;
    },
    componentsFromValue: node => [
        'module',
        ' ',
        node.identifier,
        ' ',
        '{',
        '\n',
        node.children.map(child => {
            return [child, ';\n']
        }) as any,
        ' ',
        '}'        
    ]
};

export const descriptors: any = {
    [AST.CodeNodeTypes.module] : theModule,
    [AST.CodeNodeTypes.callExpression] : callExpression,
    [AST.CodeNodeTypes.memberAccess] : memberAccessExpression,
    [AST.CodeNodeTypes.mapLiteral] : mapLiteral,
    [AST.CodeNodeTypes.declaration] : declaration,
    [AST.CodeNodeTypes.numericLiteral] : numericLiteral,
    [AST.CodeNodeTypes.stringLiteral] : stringLiteral,
    [AST.CodeNodeTypes.arrayLiteral] : arrayLiteral,
    [AST.CodeNodeTypes.assignment] : assignment,
};
