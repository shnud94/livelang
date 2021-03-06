import '../prototype/index';
import * as AST from '../ast/index';
import * as fs from 'fs';
import * as _ from 'underscore';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as parser from '../parser/custom';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsEmitter from './js-emitter'
import * as style from '../frontend/javascriptStyle'
import * as checker from '../types/checker'
import * as http from 'http'
import { ProjectView } from '../view/project/project-view'
import { ipcRenderer } from 'electron'
import { EventSource } from '../util/events'
import { LineChecker } from 'line-column';
const sockjs = require('sockjs')


let messageListener = console.log.bind(console);
const echo = sockjs.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js' });
echo.on('connection', function (conn) {
    conn.on('data', function (message) {
        messageListener(message);
    });
    conn.on('close', function () { });
});

const server = http.createServer();
echo.installHandlers(server);
server.listen(9999, 'localhost');

let files = {};
http.createServer((request, res) => {
    const id = request.url.split('/')[1];
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(files[id]);
}).listen(3456, 'localhost');

const w = window as any;
w.livelang = { checker };

interface SerializedProject {
    rootDir?: string,
    openFiles: string[]
}
interface GlobalSettings {
    node_modules: string,
    tmp: string,
    userhome: string
}
export interface FileHandle {
    content: string,
    _savedContent: string,
    lineChecker: LineChecker

    // For now tied to storage on hard disk, later on change things so we can store these wherever?
    filename: string
    save()
    reload()
}

export class RunSession {
    constructor(public checky: checker.TypeChecker) { }
    onEvent: Function
}

export class LiveLangProject {

    private openFiles: { [path: string]: FileHandle } = {}
    rootDir: string

    static getGlobalSettings(): GlobalSettings {
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
                this.openFiles[path] = this.getHandleFromFile(path);
                this.render();
            }
        });

        this.initProject();
        this.render();
    }

    onNewRunSession = new EventSource<RunSession>();
    lastTypeCheck?: checker.TypeCheckContext

    count = 0;
    render() {
        ReactDOM.render(React.createElement(ProjectView, {
            project: this,
            typeCheckContext: this.lastTypeCheck,
            something: ++this.count
        } as any), document.getElementById('livelang-root'));
    }

    initProject() {
        const projectConfigPath = path.join(this.project.rootDir, 'project.ll');
        if (!fs.existsSync(projectConfigPath)) {
            fs.writeFileSync(projectConfigPath, '{}');
        }
        const config = fs.readFileSync(projectConfigPath);
        // don't do anything with this just yet, nothing to really config...
    }

    createNewFile(filename: string) {
        fs.writeFileSync(path.join(this.rootDir, filename), '');
    }

    onProjectChanged() {
        const unparsed = this.getAllModules();
        const parsed = unparsed.map(module => parser.parseSpecCached(
            style.theModule,
            module._savedContent,
            style.theModule.id
        ));
        let modules: AST.ModuleNode[] = parsed.map(p => {
            if (p.error) {
                console.error(p.error);
            }
            return p.result;
        }).filter(m => m != null);
        const modulesByIdentifier = _.indexBy(modules, m => m.identifier.value)
        const mainModule = modulesByIdentifier['main'];

        if (!mainModule) {
            console.error("No main module!");
            return;
        }

        let nodesById = {};
        modules.forEach(mod => AST.reviveNode(mod, null, nodesById));

        const checky = checker.createChecker(modules);
        this.lastTypeCheck = checky.context;

        if (checky.context.errors && checky.context.errors.length > 0) {
            this.render();
        }
        else {
            const js = jsEmitter.emitJs(modules, { checker: checky.checker, endpoint: 'http://localhost:9999' });
            files[0] = js;

            const session = new RunSession(checky.checker);
            messageListener = message => {

                if (!session.onEvent) {
                    console.log('no event handler');
                    console.log(message);
                    return;
                }
                message = JSON.parse(message);
                if (message._id && nodesById[message._id]) {
                    const node = nodesById[message._id];
                    session.onEvent({
                        event: 'nodeResult',
                        node,
                        result: _.omit(message, '_id')
                    })
                }
            };
            ipcRenderer.send('run', 0);
            this.onNewRunSession.message(session)
        }
    }

    getHandleFromFile(filename: string): FileHandle | null {
        function loadFile(): string {
            return fs.readFileSync(filename).toString();
        }

        const initialContent = loadFile();

        const handle = {
            content: initialContent,
            filename,
            lineChecker: require('line-column')(initialContent),
            _savedContent: initialContent,
            reload() {
                handle.content = loadFile();
            },
            save() {
                fs.writeFileSync(filename, handle.content);
                handle.lineChecker = require('line-column')(handle.content);
                handle._savedContent = handle.content;
            }
        };

        const watcher = chokidar.watch(filename, {
            persistent: true
        });

        watcher.on('change', path => {

            handle.reload();
            this.onProjectChanged();

        }).on('unlink', path => {

            watcher.close();
            delete this.openFiles[path];
        });

        return handle;
    }

    getAllModules(): FileHandle[] {
        return _.values(this.openFiles);
    }
}