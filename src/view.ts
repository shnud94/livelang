import * as reactive from './reactive';
import {ReactiveVar} from './reactive';
import * as html from './html';
import * as $ from 'jquery';

export class DOMAdapter {

    private nextId = 0;
    constructor(public container: HTMLElement) {}

    autoRender(renderer: () => string) {
        reactive.autorun(() => {
            this.renderRawHTML(renderer());
        });
    }

    renderRawHTML(content: string) {
        this.container.innerHTML = content;
    }

    private attachEventListener(type: string, handler: (event: Event) => void) {
        const id = type + '.' + (++this.nextId).toString();
        $(this.container).on(id, event => {
            handler(event);
        });

        return {
            remove: () => $(this.container).off(id)
        }
    }

    events = {
        onClick: (listener: (event: Event) => void) => this.attachEventListener('click', listener),
        onKeyup: (listener: (event: Event) => void) => this.attachEventListener('keyup', listener),
        onFocus: (listener: (event: Event) => void) => this.attachEventListener('focus', listener),
        onBlur: (listener: (event: Event) => void) => this.attachEventListener('blur', listener),
        onMouseMove: (listener: (event: Event) => void) => this.attachEventListener('mousemove', listener),
        onMouseOver: (listener: (event: Event) => void) => this.attachEventListener('mouseover', listener),
        onMouseOut: (listener: (event: Event) => void) => this.attachEventListener('mouseout', listener)
    }    
}

interface View {}
interface HTMLView extends View {
    renderHTML(container: DOMAdapter) : string
}

// export class Parent implements HTMLView {
//     children = new reactive.ReactiveVar<HTMLView[]>([]);

//     constructor(private container: DOMAdapter) {
        
//     }

//     renderHTML(container: DOMAdapter) {
//         container.autoRender(() => {
//             return this.children.get().map(c => c.renderHTML(d)).join('')
//         });
//     }
// }

// export class TextView implements HTMLView {

//     textContent = new ReactiveVar('');
//     style = new ReactiveVar<CSSStyleDeclaration | any>({});

//     renderHTML() : string {
//         return `<div contentEditable="true">${this.textContent.get()}</div>`;
//     }
// }

// export class FlexView implements HTMLView {

//     children = new reactive.ReactiveVar<HTMLView[]>([]);

//     renderHTML() {
//         const childHTML = this.children.get().map(c => c.renderHTML()).join('');
//         const style: any = {
//             display: 'flex'
//         }
        
//         return `<div style="${html.styleStringFromCSSProperties(style)}">${childHTML}</div>`;
//     }
// }