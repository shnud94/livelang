import * as React from 'react';
import * as DOM from 'react-dom';
import * as program from '../../program';
import {AST, Helpers, Program} from '../../program';
import {LineLikeProps, LineLikeCallbacks, wrapLineLike, NodeProps} from './index';
import * as _ from 'underscore';
import * as $ from 'jquery';
import * as util from './util';

export type VariableDeclarationProps = LineLikeProps & NodeProps<AST.VariableDeclarationNode>;
export class VariableDeclaration extends React.Component<VariableDeclarationProps, any> {

    render() : JSX.Element {

        const onIdentifierChange = (event: KeyboardEvent) => {
            const val = (event.target as HTMLInputElement).value;
            if (val.length > 0) {
                this.props.node.identifier = val;
                this.forceUpdate();
            }
        };

        const onMutableClick = () => {
            this.props.node.mutable = !this.props.node.mutable;
            this.forceUpdate();
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (event.keyCode !== 13) {
                return;
            }

            const htmlTarget = event.target as HTMLElement;
            if (htmlTarget.tagName.toLowerCase() !== 'input') {
                return;
            }
            const input = htmlTarget as HTMLInputElement,
                caret = util.getCaretFraction(input);

            if (caret !== 0 && caret !== 1) {
                return;
            }

            if (caret === 0 && input === firstInputRef) {
                this.props.onReturnStart(this.props.node._id);
            }
            else if (caret === 1 && input !== firstInputRef) {
                this.props.onReturnEnd(this.props.node._id);
            }
        };

        let equalsPart: JSX.Element;
        const initialValueType = this.props.node.initialValue.type;
        if (initialValueType === AST.CodeNodeTypes.expression) {
            equalsPart = <div>"I am an expression"</div>;
        }
        else if (initialValueType === AST.CodeNodeTypes.literalNode) {
            const literal = this.props.node.initialValue as AST.LiteralNode,
                valueType = literal.value.type;

            if (valueType === 'string') {
                equalsPart = <StringLiteral ref={(input: StringLiteral) => lastInputRef = input} node={literal} />;
            }
            else if (valueType === 'float' || valueType === 'integer') {
                equalsPart = <NumberLiteral ref={(input: NumberLiteral) => lastInputRef = input} node={literal} />;    
            }
            else if (valueType === 'boolean') {
                equalsPart = <BooleanLiteral ref={(input: BooleanLiteral) => lastInputRef = input} node={literal} />;
            }
        }

        var firstInputRef: HTMLInputElement = null,
            lastInputRef: React.Component<any, any> | HTMLInputElement = null;

        return wrapLineLike(<div onKeyUp={onKeyUp} className="codeLine variableDeclaration">
            <input className="mutable" type="checkbox" onChange={onMutableClick} name="mutable" checked={this.props.node.mutable}/><label name="mutable">mut</label> <input ref={input => firstInputRef = input} 
                onChange={onIdentifierChange} 
                onKeyUp={onIdentifierChange} 
                value={this.props.node.identifier} /> = {equalsPart}
        </div>, {
            goToLineEnd() {
                if (lastInputRef) {
                    if ((lastInputRef as any).goToFraction) {
                        (lastInputRef as any).goToFraction(1);
                    }
                    else {
                        let input = lastInputRef as HTMLInputElement;
                        util.setCaretPosition(input, input.value.length);
                    }
                }
            },
            goToLineStart() {
                if (firstInputRef) {
                    util.setCaretPosition(firstInputRef, 0);
                }
            },
            getNextInput: prev => {
                return $(lastInputRef).find('input')[0] as HTMLInputElement;
            },
            getPreviousInput: next => {
                return firstInputRef;
            }
        });
    }
}

export class StringLiteral extends React.Component<any & NodeProps<AST.LiteralNode>, any> {

    goToFraction(fraction: number) {
        const input = (this as any).inputRef as HTMLInputElement;
        if (input) {
            util.setCaretFraction(input, fraction);
        }
    }

    render() : JSX.Element {
        const onChange = (event: KeyboardEvent) => {
            this.props.node.value.value = (event.target as HTMLInputElement).value;  
            this.forceUpdate();
        };
        
        return <input type="string" ref={input => (this as any).inputRef = input} onKeyUp={onChange} onChange={onChange} value={this.props.node.value.value} />
    }
}

export class NumberLiteral extends React.Component<any | NodeProps<AST.LiteralNode>, any> {

    goToFraction(fraction: number) {
        const input = (this as any).inputRef as HTMLInputElement;
        if (input) {
            util.setCaretFraction(input, fraction);
        }
    }

    render() : JSX.Element {
        const onChange = (event: KeyboardEvent) => {
            const value = (event.target as HTMLInputElement).value,
            parsed = Helpers.parseStringToVariable(value);

            if (parsed) {
                const parsedValue = (parsed as AST.TypedValue),
                    type = parsedValue.type;

                if (type === 'float' || type === 'integer') {
                    this.props.node.value = parsedValue; 
                    this.forceUpdate();
                }
            }
        };

        let step = this.props.node.type === 'integer' ? 1 : 'any';

        return <input type="text" ref={input => (this as any).inputRef = input} onKeyUp={onChange} onChange={onChange} value={this.props.node.value.value} />
    }
}

export class BooleanLiteral extends React.Component<any | NodeProps<AST.LiteralNode>, any> {

    goToFraction(fraction: number) {
        const input = (this as any).inputRef as HTMLInputElement;
        if (input) {
            util.setCaretFraction(input, fraction);
        }
    }

    render() : JSX.Element {
        const onClick = () => {
          this.props.node.value.value = !this.props.node.value.value;  
          this.forceUpdate();
        };

        return <input type="checkbox" ref={input => (this as any).inputRef = input} onClick={onClick} value={this.props.node.value} />;
    }
}