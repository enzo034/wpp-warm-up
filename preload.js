const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

    initializeClients: (clientCount) => ipcRenderer.invoke('initialize-clients', clientCount),

    onQRGenerated: (callback) => ipcRenderer.on('qr', callback),

    onReady: (callback) => ipcRenderer.on('ready', callback),

    logoutClients: () => ipcRenderer.invoke('logout-clients'),

});
