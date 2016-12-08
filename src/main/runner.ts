import {ipcMain, BrowserWindow} from 'electron'

let currentWindow: Electron.BrowserWindow | null;

ipcMain.on('run', (event, id) => {
    if (!currentWindow || currentWindow.isDestroyed()) {
        currentWindow = new BrowserWindow({width: 800, height: 600});
    }
    currentWindow.loadURL('file://' + __dirname + '/../../src/blank.html');
    currentWindow.webContents.openDevTools();
    currentWindow.webContents.on('did-finish-load', () => {
        currentWindow.webContents.executeJavaScript(`
            var my_awesome_script = document.createElement('script');
            my_awesome_script.setAttribute('src','http://localhost:3456/${id}');
            document.head.appendChild(my_awesome_script);
        `)
    });
});