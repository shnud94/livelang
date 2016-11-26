import '../prototype/index';
import * as AST from '../ast/index';
import * as fs from 'fs';
import * as program from '../program';
import * as _ from 'underscore';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as projectView from '../view/project/project-view';
import * as $ from 'jquery';

interface SerializedProject {
  rootDir?: string,
  openFiles: string[]
}
interface GlobalSettings {
    node_modules: string,
    tmp: string,
    userhome: string
}
export interface ModuleHandle {
    content: string,
    _savedContent

    // For now tied to storage on hard disk, later on change things so we can store these wherever?
    filename: string
    save()
    reload()
}

export class LiveLangProject {

    private openModules: {[path: string]: ModuleHandle} = {}
    rootDir: string

    static getGlobalSettings() : GlobalSettings {
        return {
            node_modules: '',
            tmp: '/tmp',
            userhome: '/Users/andrewshand'
        }
    } 

    constructor(private project: SerializedProject) {
        this.rootDir = project.rootDir;

        const watcher = chokidar.watch(this.rootDir, {
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
                this.render();
            }
        });

        this.initProject();
        this.render();
    }

    render() {
        projectView.mount($('#livelang-root')[0], this);
    }

    initProject() {
        const projectConfigPath = path.join(this.project.rootDir, 'project.ll');
        if (!fs.existsSync(projectConfigPath)) {
            fs.writeFileSync(projectConfigPath, '{}');
        }
        const config = fs.readFileSync(projectConfigPath);
        // don't do anything with this just yet, nothing to really config...
    }

    getHandleFromFile(filename: string) : ModuleHandle | null {
        function loadFile() : string {
            return fs.readFileSync(filename).toString();
        }    

        const handle = {
            content: loadFile(),
            filename,
            _savedContent: loadFile(),
            reload() {
                handle.content = loadFile();
            },
            save() {
                fs.writeFileSync(filename, handle.content);
                handle._savedContent = handle.content;
            }
        };

        if (!handle || !handle.content) return null;

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
        return _.values(this.openModules);
    }
}