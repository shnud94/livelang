import * as programLineView from '../view/programLineView';
import * as AST from '../ast/index';
import * as fs from 'fs';
import * as program from '../program';
import * as _ from 'underscore';
import * as chokidar from 'chokidar';
import * as path from 'path';

interface SerializedProject {
  rootDir?: string,
  openFiles: string[]
}

interface GlobalSettings {
    node_modules: string,
    tmp: string,
    userhome: string
}

interface ModuleHandle {
    root: AST.ModuleNode,

    // For now tied to storage on hard disk, later on change things so we can store these wherever?
    filename: string
    save()
    reload()
}

export class LiveLangProject {

    private openModules: {[path: string]: ModuleHandle} = {}

    static getGlobalSettings() : GlobalSettings {
        return {
            node_modules: '',
            tmp: '/tmp',
            userhome: '/Users/andrewshand'
        }
    } 

    constructor(private project: SerializedProject) {
        const watcher = chokidar.watch(project.rootDir, {
          persistent: true,
          alwaysStat: true,
          ignored: /[\/\\]\./
        });

        // Only really applicable to when things are being 
        // stored in a standard filesystem but oh well. Cross dat 
        // bridge when we come to it
        watcher.on('add', (path, stat) => {
            if (!stat.isDirectory()) {
                this.openModules[path] = this.getHandleFromFile(path);
            }
        });
    }

    getHandleFromFile(filename: string) : ModuleHandle | null {
        function loadFile() : AST.ModuleNode | null {
            const data = fs.readFileSync(filename).toString();
            if (!data.length) return null;

            try {
                return JSON.parse(data);
            } catch (e) {
                console.error(`error loading ${filename}: ` + e);
                return null;
            }
        }    

        const handle = {
            root: loadFile(),
            filename,
            reload() {
                handle.root = loadFile();
            },
            save() {
                fs.writeFileSync(filename, program.nodeToJSON(handle.root));
            }
        };

        if (!handle || !handle.root) return null;

        const watcher = chokidar.watch(filename, {
          persistent: true
        });

        watcher.on('change', path => {

            handle.reload();
        }).on('unlink', path => {

            watcher.close();
            delete this.openModules[path];   
        });

        return handle;
    }

    getAllModules() : ModuleHandle[] {

        let handles: ModuleHandle[] = []; 
        
        const addFilesInDirectory = (dirPath: string) => {
            fs.readdirSync(dirPath).forEach(filename => {

                const completePath = path.join(dirPath, filename);
                const stat = fs.statSync(completePath);
                if (stat.isDirectory()) {
                    addFilesInDirectory(completePath);
                }
                else {
                    const handle = this.getHandleFromFile(completePath);
                    if (handle) handles.push(handle);            
                }
            })
        }

        addFilesInDirectory(this.project.rootDir);
        return handles;
    }

}