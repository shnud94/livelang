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
        
        if (node.type === AST.CodeNodeTypes.callExpression) {
            // Transform call expressions to operators back into binary expressions

            const asCallExpression = node as any as AST.CallExpressionNode;
            if (asCallExpression.target.type === AST.CodeNodeTypes.identifier) {
                const identifier = (asCallExpression.target as AST.Identifier).value;

                if (binaryOpSet.has(identifier)) {
                    return binaryExpression as NodeTextDescription<any>;
                }
            }
        }
        
        return descriptors[node.type] as NodeTextDescription<T>;
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

const binaryOperators = ['*', '/', '+', '-', '>', '<', '>=', '<=', '==', '!=', '&&', '||'];
const binaryOpSet = new Set(binaryOperators);
const __ = {'*': {charset: ' \xA0\\t\\n\\v\\f'}};
const ___ = {'+': {charset: ' \xA0\\t\\n\\v\\f'}};

export const identifier: NodeTextDescription<AST.Identifier> = {
    id: AST.CodeNodeTypes.identifier,
    updateValueFromComponents: (components, prev) => {
        if (!prev) {
            prev = {
                type: AST.CodeNodeTypes.identifier,
                value: null,
                _parent: prev ? prev._parent : null
            }
        }

        prev.value = flat(components) as string;
        return prev;
    },
    getTextSpecs() {
        return [
            {all: [
                {charset: 'a-zA-Z'},
                {'*' : {charset: 'a-zA-Z0-9_-'}}
            ]}
        ]
    },
    componentsFromValue: node => {
        return [node.value.toString()]
    }
}

export const numericLiteral: NodeTextDescription<AST.NumericLiteralNode> = {
    id: AST.CodeNodeTypes.numericLiteral,
    updateValueFromComponents: (components, prev) => {
        if (!prev) {
            prev = program.createNode({
                type: AST.CodeNodeTypes.numericLiteral,
                value: 0,
                _parent: null
            })
        }
        prev.value = parseFloat(flat(components));
        return prev;
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
        return program.createNode({
            type: AST.CodeNodeTypes.stringLiteral,
            value: value.substr(1, value.length - 2),
            _parent: prev ? prev._parent : null
        })
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
            prev = program.createNode({
                type: AST.CodeNodeTypes.mapLiteral,
                value: null,
                _parent: prev ? prev._parent : null
            })
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
            prev = program.createNode({
                _parent: null,
                target: null,
                input: null,
                type: AST.CodeNodeTypes.callExpression
            })
        }

        const valid = {'!':true,'-':true};
        let identifier: AST.Identifier = assignParent(flat(components[0]) as AST.Identifier, prev);
        prev.target = identifier;

        if (!valid[identifier.value]) {
            console.error('Invalid operator for prefix expression')
            identifier.value = '!';
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
            prev = program.createNode({
                _parent: null,
                value: null,
                type: AST.CodeNodeTypes.arrayLiteral
            });
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
            prev = program.createNode({
                _parent: null,
                subject: null,
                member: null,
                type: AST.CodeNodeTypes.memberAccess
            })
        }

        prev.subject = flat(components[0]) as AST.ExpressionType;
        prev.member = flat(components[2]) as AST.Identifier;

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
            prev = program.createNode({
                _parent: null,
                input: null,
                target: null,
                type: AST.CodeNodeTypes.callExpression
            })
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
    
    const createConditionForOp = op => ({all: [expression, __, op, __, expression]});
    
    return {
        id: 'binaryExpression',
        updateValueFromComponents: (components, prev) => {

            if (!prev) {
                prev = program.createNode({
                    type: AST.CodeNodeTypes.callExpression,
                    _parent: null,
                    target: null,
                    input: null
                })
            }

            prev.target = AST.createIdentifier(flat(components)[2]);
            prev.input = AST.createArrayLiteral([flat(components)[0] as any, flat(components)[4] as any]);
            return prev;
        },
        getTextSpecs: () => [{or: 
            binaryOperators.map(createConditionForOp)
        }],
        componentsFromValue: node => {
            const input = node.input as AST.ArrayLiteralNode;    
            
            return [
                input.value[0], 
                ' ',
                (node.target as AST.Identifier).value,
                ' ',
                input.value[1]
            ]
        },
        denyReparse: true
    } as NodeTextDescription<AST.CallExpressionNode>
})();

const expressions = [
    identifier,
    numericLiteral,
    stringLiteral,
    arrayLiteral,
    binaryExpression,    
    prefixExpression,    
    memberAccessExpression,
    callExpression,
];

export const expression: TextDescription<AST.ExpressionType> = {
    id: 'expressionType',
    updateValueFromComponents: (components, prev) => {
        let val = flat(components);
        if (Array.isArray(val) && val[0] === '(') {
            val = val[1];
        }
        return val;
    },
    getTextSpecs: () => [
        {or: [
            {all: ['(', {or: expressions}, ')']},
            {or: expressions}
        ]}
    ],
    componentsFromValue: value => [
        '(',
        descriptors[value.type],
        ')'
    ]
}

export const assignment: NodeTextDescription<AST.AssignmentNode> = {
    id: AST.CodeNodeTypes.assignment,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                type: AST.CodeNodeTypes.assignment,
                _parent: null,
                identifier: null,
                valueExpression: null
            })
        }

        prev.identifier = flat(components[0]) as AST.Identifier;
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

export const typeDeclaration: NodeTextDescription<AST.TypeDeclaration> = {
    id: AST.CodeNodeTypes.typeDeclaration,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                type: AST.CodeNodeTypes.typeDeclaration,
                _parent: null, // TODO: How are we going to make sure parent isn't null when first creating a node?
                identifier: null,
                typeExpression: null
            });
        }

        prev.identifier = assignParent(flat(components[2]), prev);
        prev.typeExpression = assignParent(flat(components.last()), prev);    
        
        return prev;
    },
    getTextSpecs: () => [
        'type',
        ___,
        identifier,
        __,
        '=', 
        __, 
        expression
    ],
    displayOptions: () => [null, null, null, null, null, null, null],
    componentsFromValue: node => [
        'type',
        ' ',
        node.identifier,
        ' ',
        '=',
        ' ',
        node.typeExpression
    ]
};

export const declaration: NodeTextDescription<AST.DeclarationNode> = {
    id: AST.CodeNodeTypes.declaration,
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                type: AST.CodeNodeTypes.declaration,
                _parent: null, // TODO: How are we going to make sure parent isn't null when first creating a node?
                mutable: null,
                identifier: null,
                valueExpression: null,
                typeExpression: null
            })
        }

        prev.mutable = (flat(components[0]) || '').trim() === 'var';
        prev.identifier = assignParent(flat(components[2]), prev);
        
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
            {or: [assignment, expression, declaration, typeDeclaration]},
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
            node = program.createNode({
                type: AST.CodeNodeTypes.module,
                _parent: null,
                identifier: null,
                version: '0.0.1', // TODO: Get the latest version that we're on right now
                children: null
            })
        }

        node.children = (flat(components[6]) as Array<any>).filter(child => typeof(child) !== 'string');
        node.identifier = assignParent(flat(components[2]), node);
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
        '',
        '}'        
    ]
};

export const descriptors: any = {
    [AST.CodeNodeTypes.module] : theModule,
    [AST.CodeNodeTypes.callExpression] : callExpression,
    [AST.CodeNodeTypes.memberAccess] : memberAccessExpression,
    [AST.CodeNodeTypes.assignment] : assignment,
    [AST.CodeNodeTypes.mapLiteral] : mapLiteral,
    [AST.CodeNodeTypes.identifier] : identifier,
    [AST.CodeNodeTypes.declaration] : declaration,
    [AST.CodeNodeTypes.numericLiteral] : numericLiteral,
    [AST.CodeNodeTypes.stringLiteral] : stringLiteral,
    [AST.CodeNodeTypes.arrayLiteral] : arrayLiteral,
    [AST.CodeNodeTypes.assignment] : assignment,
    [AST.CodeNodeTypes.typeDeclaration] : typeDeclaration
};
