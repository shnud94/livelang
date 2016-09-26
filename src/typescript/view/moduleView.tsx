import * as program from '../program';
import {AST, Program} from '../program';
import * as $ from 'jquery';
import * as util from './util';
import * as utils from '../util/index';
import {Result} from '../util/index';
import {EventSource} from '../util/events';
import * as Frontend from '../frontend/index';
import {NodeTextDescription, TextComponent, TextSpec} from '../frontend/index';
import * as js from '../frontend/javascriptStyle';
import {RenderResult, RenderContext, NodeEvents, NodeTextController, ComponentDescription} from './index';
import * as parserCustom from '../parser/custom';
import * as nearley from '../parser/nearley';
import {DOMData} from './programView';
import * as _ from 'underscore';
import * as Nearley from 'nearley';
import * as React from 'react';

interface ModuleViewState {
    openModules: Set<string>
}
interface ModuleViewProps {
    moduleClicked: (mod: AST.ModuleNode) => void, 
    modules: AST.ModuleNode[] 
    currentModule?: AST.ModuleNode
}
let nextModuleNumber = 1;

export class ModuleView extends React.Component<ModuleViewProps, ModuleViewState> {

    constructor(props) {
        super(props);
        this.state = {
            openModules: new Set()
        };
    }
    render() : JSX.Element {

        const self = this;

        function renderModule(mod: AST.ModuleNode) : JSX.Element {
            
            const children = mod.children.filter(child => child.type === 'module');
            let childrenElement: JSX.Element = null;
            let open = self.state.openModules.has(mod._id);

            if (children.length && open) {
                childrenElement = <div className="children">{children.map(renderModule)}</div>;
            }

            function onClick(event: React.MouseEvent<any>) {
                event.stopPropagation();
                
                if (mod === self.props.currentModule) {    
                    const {openModules} = self.state;
                    if (openModules.has(mod._id)) openModules.delete(mod._id);
                    else openModules.add(mod._id);

                    self.forceUpdate();
                }                
                
                self.props.moduleClicked(mod);
            }

            function add(event: React.MouseEvent<any>) {
                event.stopPropagation();
                self.state.openModules.add(mod._id);
                mod.children.push(program.createNode(AST.createModule('module' + (nextModuleNumber++).toString(), mod)));
                self.forceUpdate();
            }

            let className = "module";
            if (self.props.currentModule === mod) className += ' -current';

            return <div className={className} onClick={onClick}>
                <div className="flex">
                    <div>{mod.identifier.value}</div> 
                    <div className="spacer"></div> 
                    <i className={open ? 'fa fa-chevron-down' : 'fa fa-chevron-right'}></i> 
                    <i onClick={add} className="fa fa-plus"></i>
                </div>
                
                {childrenElement}
            </div>
        }

        return <div className="moduleView">{self.props.modules.map(renderModule)}</div>
    }
}