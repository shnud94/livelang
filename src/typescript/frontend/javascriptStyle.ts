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
    if (typeof(node) !== 'object' || node == null) return;
    node._parent = parent; return node;
}

export const frontendDescription = {
    descriptorForNode<T extends AST.Nodes>(node: T) : NodeTextDescription<T> {
        
        if (node.type === 'expressioncallExpression') {
            // Transform call expressions to operators back into binary expressions

            const asCallExpression = node as any as AST.CallExpressionNode;
            if (asCallExpression.target.type === 'expressionidentifier') {
                
                const identifier = (asCallExpression.target as AST.Identifier).value;

                if (binaryOpSet.has(identifier)) {
                    return binaryExpression as NodeTextDescription<any>;
                }
            }
        }

        if (node.type === 'module') return theModule as any;
        if (node.type === 'expressioncallExpression') return callExpression as any;
        if (node.type === 'expressionmemberAccess') return memberAccessExpression as any;
        if (node.type === 'expressionfunctionAccess') return functionAccessExpression as any;
        if (node.type === 'assignment') return assignment as any;
        if (node.type === 'expressionmapLiteral') return mapLiteral as any;
        if (node.type === 'expressionidentifier') return identifier as any;
        if (node.type === 'declaration') return declaration as any;
        if ((node as any).type === 'expressionmapLiteral') return mapLiteral as any; // Why this particular one doesn't work I have no clue
        if (node.type === 'expressionnumericLiteral') return numericLiteral as any;
        if (node.type === 'expressionstringLiteral') return stringLiteral as any;
        if (node.type === 'expressionarrayLiteral') return arrayLiteral as any;
        if (node.type === 'typeDeclaration') return typeDeclaration as any;
        
        return null as any;
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
    id: 'identifier',
    updateValueFromComponents: (components, prev) => {
        if (!prev) {
            prev = {
                type: 'expressionidentifier',
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
                {'*' : {charset: 'a-zA-Z0-9_'}}
            ]}
        ]
    },
    componentsFromValue: node => {
        return [node.value.toString()]
    }
}

export const numericLiteral: NodeTextDescription<AST.NumericLiteralNode> = {
    id: 'numericLiteral',
    updateValueFromComponents: (components, prev) => {
        if (!prev) {
            prev = program.createNode({
                type: 'expressionnumericLiteral',
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
    id: 'stringliteral',
    updateValueFromComponents: (components, prev) => {
        const value = flat(components);
        return program.createNode({
            type: 'expressionstringLiteral',
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

const objectField = () => ({all: [identifier, __, ':', __, expression]});

export const mapLiteral: NodeTextDescription<AST.MapLiteralNode> = {
    id: 'mapLiteral',
    updateValueFromComponents: (components, prev) => {
        if (!prev) {
            prev = program.createNode({
                type: 'expressionmapLiteral',
                value: {},
                _parent: prev ? prev._parent : null
            })
        }

        prev.value = {};
        const objects = flat(components).filter(c => typeof(c) === 'object') as any;
        objects.forEach((obj, i) => {
            if (i % 2 == 0) return;
            prev.value[objects[i - 1].value] = assignParent(obj, prev);
        });
        return prev;
    },
    getTextSpecs() {
        return [
            '{',
            __,
            optionally(commaSeparated(objectField())),
            __, 
            '}'
        ]
    },
    componentsFromValue: node => {
        return [
            '{\n',
            _.keys(node.value).map((key, index, array) => {
               return ['\t', key, ':', ' ', node.value[key], index < array.length - 1 ? ',' : '', '\n']; 
            }) as any,
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
                type: 'expressioncallExpression'
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
    id: 'arrayLiteral',
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                _parent: null,
                value: null,
                type: 'expressionarrayLiteral'
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

export const functionAccessExpression: NodeTextDescription<AST.FunctionAccessExpression> = {
    id: 'functionAccess',
    updateValueFromComponents: (components, prev) => {
 
        if (!prev) {
            prev = program.createNode({
                _parent: null,
                subject: null,
                member: null,
                type: 'expressionfunctionAccess'
            })
        }

        prev.subject = assignParent(flat(components[0]) as AST.ExpressionType, prev);
        prev.identifier = assignParent(flat(components[2]) as AST.Identifier, prev);

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        '->',
        identifier     
    ]),
    componentsFromValue: node => [
        node.subject,
        '->',
        node.identifier
    ]
}

export const memberAccessExpression: NodeTextDescription<AST.MemberAccessExpression> = {
    id: 'memberAccess',
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                _parent: null,
                subject: null,
                member: null,
                type: 'expressionmemberAccess'
            })
        }

        prev.subject = assignParent(flat(components[0]) as AST.ExpressionType, prev);
        prev.member = assignParent(flat(components[2]) as AST.Identifier, prev);

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
    id: 'callExpression',
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                _parent: null,
                input: null,
                target: null,
                type: 'expressioncallExpression'
            })
        }

        prev.target = assignParent(flat(components[0]) as AST.ExpressionType, prev);
        prev.input = assignParent(flat(components[1])[1] as AST.ArrayLiteralNode, prev);

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        {all: ['(', {'?': arrayLiteral}, ')']}        
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
                    type: 'expressioncallExpression',
                    _parent: null,
                    target: null,
                    input: null
                })
            }

            const [lhs, rhs] = [flat(components)[0] as any, flat(components)[4] as any];
            prev.target = AST.createIdentifier(flat(components)[2], prev);
            if (lhs && rhs) {
                prev.input = AST.createArrayLiteral([lhs, rhs], prev);
            }

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
    mapLiteral,
    functionAccessExpression,
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
        value,
        ')'
    ]
}

export const assignment: NodeTextDescription<AST.AssignmentNode> = {
    id: 'assignment',
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                type: 'assignment',
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
    id: 'typeDeclaration',
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                type: 'typeDeclaration',
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
    id: 'declaration',
    updateValueFromComponents: (components, prev) => {
        
        if (!prev) {
            prev = program.createNode({
                type: 'declaration',
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
    id: 'module',
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
                type: 'module',
                _parent: null,
                identifier: null,
                version: '0.0.1', // TODO: Get the latest version that we're on right now
                children: null
            })
        }

        node.children = (flat(components[6]) as Array<any>).filter(child => typeof(child) !== 'string').map(child => {
            return assignParent(child, node);    
        });
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