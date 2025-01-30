const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

    initializeClients: (clientCount, hoursSending, minTime, maxRandTime) => ipcRenderer.invoke('initialize-clients', clientCount, hoursSending, minTime, maxRandTime),

    onQRGenerated: (callback) => ipcRenderer.on('qr', callback),

    onReady: (callback) => ipcRenderer.on('ready', callback),

    onFinishedSendingMessage: (callback) => ipcRenderer.on('onFinishedSendingMessage', callback),

    onSendingMessage: (callback) => ipcRenderer.on('onSendingMessage', callback),

    logoutClients: () => ipcRenderer.invoke('logout-clients'),

    showAlert: (message) => ipcRenderer.invoke('custom-alert', message)

});
