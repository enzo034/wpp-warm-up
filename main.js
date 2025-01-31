const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const { initializeClients, logoutAllClients, addClient, logoutClient } = require('./whatsapp.js')

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
        try {
            await initializeClients(clientCount, mainWindow, hoursSending, minTime, maxRandTime);
            return 'Clientes inicializados, el envío de mensajes va a comenzar';
        } catch (error) {
            console.log(error);
            return `Error al inicializar clientes: ${error.message}`;
        }
    });
    
    ipcMain.handle('add-single-client', async (event) => {
        try {
            await addClient(mainWindow);
            return 'Cliente inicializado y agregado correctamente';
        } catch (error) {
            console.log(error);
            return `Error al agregar cliente: ${error.message}`;
        }
    });

    ipcMain.handle('logout-single-client', async (event, phoneNumber) => {
        await logoutClient(phoneNumber);
        return `Cliente con número ${phoneNumber} eliminado.`
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