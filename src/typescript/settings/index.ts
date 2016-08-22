const fs = require('fs-extra');
import {remote} from 'electron';
import * as path from 'path';

let settingsById: {[id: string] : Setting<any>} = {};

interface Setting<T> {
    get() : T,
    set(val: T)
}

function createSetting<T>(id: string, defaultValue?: T) : Setting<T> {
    return new ElectronSetting(id, defaultValue); 
}

class ElectronSetting<T> implements Setting<T> {
    /**
     * T should be JSON serializable
     */
    constructor(private id: string, private defaultValue?: T) {
        if (settingsById[id]) {
            console.error(`Declared two settings with the same name!`);
            process.exit();
        }

        settingsById[id] = this;        
    } 

    private getPath() {
        return path.join(remote.app.getPath('appData'), 'Livelang', `${this.id}.json`);
    }  

    get() : T {
        try {
            return JSON.parse(fs.readFileSync(this.getPath()).toString());
        } catch (e) {
            console.error(`Couldn't load setting: ${e}`);
            return this.defaultValue;
        }
    }   

    set(val: T) {
        fs.outputFile(this.getPath(), JSON.stringify(val));
    }
}

export const lastOpenedFile = new ElectronSetting<string>('lastOpenedFile');