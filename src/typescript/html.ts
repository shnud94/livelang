import * as _ from 'underscore';

export function styleStringFromCSSProperties(properties: any) {
    return _.keys(properties).map(prop => {
        return `${prop}: ${properties[prop]};`;
    }).join(' ');    
}