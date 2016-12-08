import * as types from './index';
import * as _ from 'underscore';

export const addField = (mapType: types.MapType, fieldName: string, fieldType: types.Type) => {
    if (mapType.map[fieldName]) {
        console.error('Cannot add duplicate field to type');
        return;
    }
}

export const pickField = (mapType: types.MapType, fieldName: string) => {
    return types.createMapType(_.pick(mapType.map, fieldName));
}

export const omitField = (mapType: types.MapType, fieldName: string) => {
    return types.createMapType(_.omit(mapType.map, fieldName));
}

export const getFields = (mapType: types.MapType) => {
    // TODO: Return as set
    return mapType.map;
}