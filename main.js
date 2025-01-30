const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const { initializeClients, logoutAllClients } = require('./whatsapp.js')

let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 1100,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    })

    mainWindow.loadFile('./public/index.html')
}

app.whenReady().then(() => {
    createWindow()

    ipcMain.handle('initialize-clients', async (event, clientCount, hoursSending, minTime, maxRandTime) => {
        const initClients = await initializeClients(clientCount, mainWindow, hoursSending, minTime, maxRandTime);

        if (!initClients) return 'Los clientes no fueron inicializados, revise los parametros de inicio.'
        if (typeof (initClients) === 'string') return initClients;

        return 'Clientes inicializados, el envio de mensajes va a comenzar';
    });

    ipcMain.handle('logout-clients', async () => {
        await logoutAllClients();
        return 'Sesiones cerradas';
    });

    ipcMain.handle('custom-alert', async (event, message) => {
        const win = BrowserWindow.getFocusedWindow();
        await dialog.showMessageBox(win, {
            type: 'warning',
            buttons: ["Ok"],
            defaultId: 0,
            cancelId: 0,
            detail: message,
            message: ''
        });
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', async () => {
    await logoutAllClients();
    if (process.platform !== 'darwin') app.quit()
})