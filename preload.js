const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

    initializeClients: (clientCount, hoursSending, minTime, maxRandTime) => ipcRenderer.invoke('initialize-clients', clientCount, hoursSending, minTime, maxRandTime),

    onQRGenerated: (callback) => ipcRenderer.on('qr', callback),

    onReady: (callback) => ipcRenderer.on('ready', callback),

    onFinishedSendingMessage: (callback) => ipcRenderer.on('onFinishedSendingMessage', callback),

    logoutClients: () => ipcRenderer.invoke('logout-clients'),

});
