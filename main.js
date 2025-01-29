const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { initializeClients, logoutAllClients } = require('./whatsapp.js')

let mainWindow;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
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
        if(typeof(initClients) === 'string') return initClients;

        return 'Clientes inicializados, el envio de mensajes va a comenzar';
    });

    ipcMain.handle('logout-clients', async () => {
        await logoutAllClients();
        return 'Sesiones cerradas';
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', async () => {
    await logoutAllClients();
    if (process.platform !== 'darwin') app.quit()
})