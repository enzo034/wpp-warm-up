const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

    initializeClients: (clientCount, hoursSending, minTime, maxRandTime) => ipcRenderer.invoke('initialize-clients', clientCount, hoursSending, minTime, maxRandTime),

    startSendingMessages: (minTime, maxRandTime, hoursSending) => ipcRenderer.invoke('start-sending-messages', minTime, maxRandTime, hoursSending),

    stopSendingMessages: () => ipcRenderer.invoke('stop-sending-messages'),

    addSingleClient: () => ipcRenderer.invoke('add-single-client'),

    addReceivingOnlyClient: (phoneNumber) => ipcRenderer.invoke('add-receiving-only-client', phoneNumber),

    logoutSingleClient: (phoneNumber) => ipcRenderer.invoke('logout-single-client', phoneNumber),

    onQRGenerated: (callback) => ipcRenderer.on('qr', callback),

    onReady: (callback) => ipcRenderer.on('ready', callback),

    onFinishedSendingMessage: (callback) => ipcRenderer.on('onFinishedSendingMessage', callback),

    onSendingMessage: (callback) => ipcRenderer.on('onSendingMessage', callback),

    logoutClients: () => ipcRenderer.invoke('logout-clients'),

    showAlert: (message) => ipcRenderer.invoke('custom-alert', message)

});
