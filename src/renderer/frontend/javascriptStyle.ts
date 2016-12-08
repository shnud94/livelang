import * as program from '../program';
import {AST, Program} from '../program';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as types from '../types/index';
import 'fuzzyset.js';
import * as index from './index';
import * as View from '../view/index';
import {TextToValue, TextDescription, TextSpec} from './index';

const frontendId = 'javascript';
const justObjects = (something: any) => {
    return _.flatten(something).filter(s => typeof(s) === 'object' && s != null);
}
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

export const output = {
    separated(array: any[], separator: string) {
        return _.flatten(array.map((el, index) => {
            if (index < array.length - 1) {
                return [el, separator];
            }
            return el;
        }));
    }
}

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
const __ = {'*': {charset: ' \xA0\\t\\n\\r\\v\\f'}};
const ___ = {'+': {charset: ' \xA0\\t\\n\\r\\v\\f'}};

export const identifier: TextToValue<AST.Identifier> = {
    id: 'identifier',
    valueFromComponents: components => ({
            type: 'expressionidentifier', 
            value: flat(components) as string
    }),
    getTextSpecs() {
        return [
            {all: [
                {charset: 'a-zA-Z'},
                {'*' : {charset: 'a-zA-Z0-9_'}}
            ]}
        ]
    }
}

export const numericLiteral: TextToValue<AST.NumericLiteralNode> = {
    id: 'numericLiteral',
    valueFromComponents: components => ({
        type: 'expressionnumericLiteral',
        value: parseFloat(flat(components)),
    }),
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
    }
}

export const stringLiteral: TextToValue<AST.StringLiteralNode> = {
    id: 'stringliteral',
    valueFromComponents: components => {
        
        const value = flat(components);
        return {
            type: 'expressionstringLiteral',
            value: value.substr(1, value.length - 2)
        }
    },
    getTextSpecs() {
        return [
            '"',
            {'*':{charset: '^"'}},
            '"'
        ]
    }
}

export const returnStatement: TextToValue<AST.ReturnStatement> = {
    id: 'returnStatement',
    valueFromComponents: components => {

        const expression = justObjects(components)[0];
        return {
            type: 'returnStatement',
            expression
        }        
    },
    getTextSpecs() {
        return [
            'return',
            __,
            expression
        ]
    }
}

export const typeCastExpression: TextToValue<AST.TypeCastExpression> = {
    id: 'returnStatement',
    valueFromComponents: components => {
        const objs = justObjects(components);
        return {
            type: 'expressionTypeCast',
            expression: objs[0],
            expressionType: objs[1]
        }
    },
    getTextSpecs() { // looks like a generic, i.e: <Type>
        return [
            expression,
            '<',
            typeExpression,
            '>'
        ]
    }
}

const objectField = () => ({all: [identifier, __, ':', __, expression]});

export const mapLiteral: TextToValue<AST.MapLiteralNode> = {
    id: 'mapLiteral',
    valueFromComponents: components => {
        
        let node: AST.MapLiteralNode = {
            type: 'expressionmapLiteral',
            value: {}
        };
 
        const objects = flat(components).filter(c => typeof(c) === 'object') as any;
        objects.forEach((obj, i) => {
            if (i % 2 == 0) return;
            node.value[objects[i - 1].value] = assignParent(obj, node);
        });
        return node;
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
}

export const prefixExpression: TextToValue<AST.CallExpressionNode> = {
    id: 'prefixExpression',
    valueFromComponents: components => {

        let node: any = {
            type: 'expressioncallExpression'
        };

        const valid = {'!':true,'-':true};
        let identifier: AST.Identifier = assignParent(flat(components[0]) as AST.Identifier, node);
        node.target = identifier;

        if (!valid[identifier.value]) {
            console.error('Invalid operator for prefix expression')
            identifier.value = '!';
        }
        
        node.input = assignParent(flat(components[1]) as any, node);
        return node;
    },
    getTextSpecs: () => [
        {charset: "-!"},
        expression
    ]
}

export const arrayLiteral: TextToValue<AST.ArrayLiteralNode> = {
    id: 'arrayLiteral',
    valueFromComponents: components => {
        const prev: AST.ArrayLiteralNode = {
            type: 'expressionarrayLiteral',
            value: []
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
    }
}

export const functionAccessExpression: TextToValue<AST.FunctionAccessExpression> = {
    id: 'functionAccess',
    valueFromComponents: components => {
 
        const prev: AST.FunctionAccessExpression = {
            type: 'expressionfunctionAccess',
            identifier: null,
            subject: null
        }
    
        prev.subject = assignParent(flat(components[0]) as AST.ExpressionType, prev);
        prev.identifier = assignParent(flat(components[2]) as AST.Identifier, prev);

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        '->',
        identifier     
    ])
}

export const memberAccessExpression: TextToValue<AST.MemberAccessExpression> = {
    id: 'memberAccess',
    valueFromComponents: components => {
        
        const prev: AST.MemberAccessExpression = {
            type: 'expressionmemberAccess',
            member: null,
            subject: null 
        }
        
        prev.subject = assignParent(flat(components[0]) as AST.ExpressionType, prev);

        const member = flat(components)[2] as AST.Nodes;
        if (member.type === 'expressionidentifier') {
            prev.member = AST.createStringLiteral(member.value, prev);
        }
        else {
            prev.member = assignParent(member as AST.ExpressionType, prev);
        }

        return prev;
    },
    getTextSpecs: () => ([
        expression,
        {or: [
            {all: ['\.', identifier]}, 
            {all: ['[', expression, ']']}
        ]}
    ])
}

export const callableLiteral: TextToValue<AST.CallableLiteral> = {
    id: 'callableLiteral',
    valueFromComponents: (components) => {    
        const node: AST.CallableLiteral = {
            type: 'expressioncallableLiteral',
            input: [],
            output: null,
            body: []
        };

        const input = _.flatten(components[1] as any);
        const inputs = [];
        let lastVar = null;
        let addVarNoType = ident => inputs.push({type: AST.createIdentifier('any'), identifier: lastVar.value});
        input.forEach(val => {
            if (typeof(val) === 'string' && val.trim() === ',') {
                if (lastVar) addVarNoType(lastVar);
                lastVar = null;
                return;
            }

            if (val != null && typeof(val) === 'object' && val.type) {
                if (lastVar) {
                    inputs.push({
                        type: val,
                        identifier: lastVar.value
                    });
                    lastVar = null;
                }
                else {
                    lastVar = val;
                }
            }
        });
        if (lastVar) addVarNoType(lastVar);

        node.input = inputs.map(input => assignParent(input, node));
        node.body = _.flatten(components[10] as any).filter(c => typeof(c) === 'object') as AST.ModuleChild[];
        node.output = justObjects(_.flatten(components[4] as any))[0] || AST.createIdentifier('null', node);
        return node;
    },
    getTextSpecs: () => ([
        '(',
        optionally(commaSeparated({all: [
            identifier, 
            {'?' : {all: [__, ':', __, expression]}}
        ]})),
        ')',
        __,
        {'?' : {all: [__, ':', __, expression]}},
        __,
        '->',
        __,
        '{',
        __,
        {'*': {all: [ // 6
            {or: [returnStatement, assignment, expression, declaration, typeDeclaration]},
            __,  
            ';',
            __
        ]}},
        __,
        '}'     
    ])
}

export const callExpression: TextToValue<AST.CallExpressionNode> = {
    id: 'callExpression',
    valueFromComponents: (components) => {

        const prev: AST.CallExpressionNode = {
            input: null,
            target: null,
            type: 'expressioncallExpression',
            _runtime: null
        }

        prev.target = assignParent(flat(components[0]) as AST.ExpressionType, prev);
        const input = justObjects(flat(components[1])) || [];
        prev.input = AST.createArrayLiteral(input as any[], prev);
        return prev;
    },
    getTextSpecs: () => ([
        expression,
        {all: ['(', optionally(commaSeparated(expression)), ')']}        
    ]),
}

export const binaryExpression: TextToValue<AST.CallExpressionNode> = (() => {
    
    const createConditionForOp = op => ({all: [expression, __, op, __, expression]});
    
    return {
        id: 'binaryExpression',
        valueFromComponents: (components) => {

            const prev: AST.CallExpressionNode = {
                type: 'expressioncallExpression',
                _runtime: null,
                target: null,
                input: null
            };

            const noWhiteSpace = flat(components).filter(c => !(typeof(c) === 'string' && c.trim().length === 0));
            const [lhs, rhs] = [noWhiteSpace[0], noWhiteSpace[2]];
            prev.target = AST.createIdentifier(noWhiteSpace[1], prev);
            if (lhs && rhs) {
                prev.input = AST.createArrayLiteral([lhs, rhs], prev);
            }
            else {
                console.warn('No lhs/rhs');
                debugger;
            }

            return prev;
        },
        getTextSpecs: () => [{or: 
            binaryOperators.map(createConditionForOp)
        }]
    } as TextToValue<AST.CallExpressionNode>
})();

const expressions = [
    identifier,
    callableLiteral,
    numericLiteral,
    stringLiteral,
    arrayLiteral,
    mapLiteral,
    functionAccessExpression,
    binaryExpression,    
    prefixExpression,    
    memberAccessExpression,
    callExpression,
    typeCastExpression
];

export const expression: TextToValue<AST.ExpressionType> = {
    id: 'expressionType',
    valueFromComponents: (components) => {
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
    ]
}

export const assignment: TextToValue<AST.AssignmentNode> = {
    id: 'assignment',
    valueFromComponents: (components) => {
  
        const prev: AST.AssignmentNode = {
            type: 'assignment',
            identifier: null,
            valueExpression: null
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
    ]
};

export const typeExpression: TextToValue<types.Type> = {
    id: 'typeExpression',
    valueFromComponents: (components) => {

        const identifier = flat(components[2]);
        const expression = flat(components.last());   

        function parseExpressionToType(expression: AST.ExpressionType) : types.Type {
            if (expression.type === 'expressionarrayLiteral') {
                return types.createArrayType(expression.value.map(val => parseExpressionToType(val)));
            }
            else if (expression.type === 'expressionmapLiteral') {
                return types.createMapType(_.mapObject(expression.value, v => {
                    return parseExpressionToType(v);
                }));
            }
            else if (expression.type === 'expressionidentifier') {
                return types.createReferenceType(expression.value);
            }

            console.error("Couldn't parse dat type boi");
            return types.getAnyType();
        }
    
        return parseExpressionToType(expression);
    },
    getTextSpecs: () => [
        {or: [arrayLiteral, mapLiteral, identifier]}
    ]
};

export const typeDeclaration: TextToValue<types.Type> = {
    id: 'typeDeclaration',
    valueFromComponents: (components) => {
        const type  = flat(components.last()) as types.Type
        type.identifier = flat(components[2]).value;
        return type;
    },
    getTextSpecs: () => [
        'type',
        ___,
        identifier,
        __,
        '=', 
        __, 
        typeExpression
    ]
};

export const declaration: TextToValue<AST.DeclarationNode> = (() => {
    const flagToText = flag => {
        return {
            'mutable' : 'mut',
            'function' : 'func'
        }[flag] || flag;
    }

    return {
        id: 'declaration',
        valueFromComponents: (components) => {
        
            const node: AST.DeclarationNode = {
                type: 'declaration',
                identifier: null,
                valueExpression: null,
                typeExpression: null,
                flags: new Set()
            }

            if ((flat(components[0]) || '').trim() === 'var') {
                node.flags.add('mutable');
            }
            else if ((flat(components[0]) || '').trim() === 'function') {
                node.flags.add('function');
            }

            node.identifier = assignParent(flat(components[2]), node);
            
            const maybeTypeExpression = (flat(components[4]) || []) [2] as any;
            if (maybeTypeExpression) {
                node.typeExpression = assignParent(maybeTypeExpression, node);
            }

            const maybeValueExpression = (flat(components[6]) || []) [2] as any;
            if (maybeValueExpression) {
                node.valueExpression = assignParent(maybeValueExpression, node);
            }
            
            return node;
        },
        getTextSpecs: () => [
            {or: ['let', 'mut', 'func']},
            ___,
            identifier,
            __,
            {'?': {all: [':', __, expression]}}, // Type expression,
            __,
            {'?': {all: ['=', __, expression]}}, // Initial assignment
        ]
    };
})();

export const theModule: TextToValue<AST.ModuleNode> = {
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
    valueFromComponents: (components) => {

        const node: AST.ModuleNode = {
            type: 'module',
            identifier: null,
            version: '0.0.1', // TODO: Get the latest version that we're on right now
            children: null
        };       

        const children = flat(components[6]);
        if (Array.isArray(children)) {
            node.children = (children as Array<any>).filter(child => typeof(child) !== 'string').map(child => {
                return assignParent(child, node);    
            });
        }
        else {
            node.children = [];
        }
        node.identifier = assignParent(flat(components[2]), node);
        return node;
    }
};