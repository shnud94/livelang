import * as electron from 'electron';
import './typescript/prototype';
import * as settings from './typescript/settings/index';
import {LLResult} from './typescript/util';
import * as path from 'path';
import * as _fs from 'fs';
import {template} from './typescript/view/menu';
const fs: typeof _fs = require('fs-extra');
const app = electron.app
const BrowserWindow = electron.BrowserWindow

let liveLang: LiveLang;
class LiveLang {
  
  openProjects: LiveLangProjectController[] = []

  main() {
    const recent = settings.recentProjects.get();
    if (recent.length === 0) {
      this.openNewProject(path.join(app.getPath('home'), 'my-livelang-project'));
    }
    else {
      this.openProjectFromPath(recent.last());
    }
  }

  openProject(project: SerializedProject) {
      const controller = LiveLangProjectController.open(project);
      this.openProjects.push(controller);
     
      controller.window.on('closed', () => {
        this.openProjects = this.openProjects.filter(p => p === controller);
      });
  }

  openProjectFromPath(path: string) : LLResult<'invalid' | 'empty', LiveLangProjectController> {
    const fileAsString = fs.readFileSync(path).toString();
    if (fileAsString.length === 0) {
      return {error: 'empty'};
    }

    try {
      const parsed = JSON.parse(fileAsString);
      this.openProject(parsed as SerializedProject);
      return {result: parsed};
    } catch (e) {
      return {error: 'invalid'};
    }
  }

  openNewProject(rootDir: string) {
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir);
    }
    this.openProject(this.newProject(rootDir));
  }

  newProject(rootDir: string) : SerializedProject {
    return {
      rootDir,
      openFiles: []
    };
  }
}

interface SerializedProject {
  rootDir?: string,
  openFiles: string[]
}

class LiveLangProjectController  {

  window: Electron.BrowserWindow

  static open(json: SerializedProject) : LiveLangProjectController {
    const self = new LiveLangProjectController();
    self.window = new BrowserWindow({width: 800, height: 600});
    self.window.loadURL('file://' + __dirname + '/../src/project.html');
    self.window.webContents.on('did-finish-load', () => {
      
    });
    
    self.window.webContents.on('dom-ready', () => {
      const stringified = JSON.stringify(json);
      console.log(`new LiveLangProject(${stringified});`);
      self.window.webContents.executeJavaScript(`new LiveLangProject(${stringified});`)
    })

    require('electron-connect').client.create(self.window);
    return self;
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

//BrowserWindow.addDevToolsExtension('/Users/shnud/Library/Application Support/Google/Chrome/Default/Extensions/dbhhnnnpaeobfddmlalhnehgclcmjimi/0.1.3.2_0');
  liveLang = new LiveLang();
  liveLang.main();

  
  template.splice(1, 0, {
   label: 'File',
   submenu: [
     {
       label: 'New Project',
       click(item, focusedWindow) {
         electron.dialog.showOpenDialog(null, {properties: ['openDirectory']}, filenames => {
           if (filenames.length) {
            liveLang.openNewProject(filenames[0]);
           }
         });
       }
     }
   ]
  });

  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
