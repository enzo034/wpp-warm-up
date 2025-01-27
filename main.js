const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const {initializeClients, logoutAllClients} = require('./whatsapp.js')

let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    })

    mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()

    ipcMain.handle('initialize-clients', async (event, clientCount) => {
        await initializeClients(clientCount, mainWindow);
        return 'Clientes inicializados';
    });

    ipcMain.handle('logout-clients', async () => {
        await logoutAllClients();
        return 'Sesiones cerradas';
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})