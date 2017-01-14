import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as project from '../../project/project';
import * as immutable from 'immutable';
import * as _ from 'underscore';
import { CommandWindow, Command } from './command-window';
import keys from '../util/keys';
import * as $ from 'jquery';
import * as errorsAndStuff from './errors';
import * as programLineView from '../module-line-view';
import { ModuleView } from './file-view';
import {TypeCheckContext} from "../../types/checker";
import {ProjectViewProps} from "./project-view";

export class OverviewView extends React.Component<ProjectViewProps, any> {

    constructor(props: ProjectViewProps) {
        super(props);
    }

    render(): JSX.Element {

        return <div>

            
        </div>
    }
}