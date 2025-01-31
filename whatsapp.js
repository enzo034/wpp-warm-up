const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { checkContact, updateMessages } = require('./data/database.js')
const puppeteer = require('puppeteer');
const { randomWordsFromJs } = require('./randomWords.js');


const logStream = fs.createWriteStream('app.log', { flags: 'a' });

console.log = function (message) {
    logStream.write(new Date().toISOString() + ' - ' + message + '\n');
};


const randomWords = randomWordsFromJs
let clientsData = [];

const DEADLINE_DATE = new Date('2025-02-25T00:00:00');

async function initializeClients(clientCount, mainWindow, hoursSending, minTime = 60, maxRandTime = 600) {

    if (new Date() > DEADLINE_DATE) {
        throw new Error('No se puede ejecutar: Fecha límite alcanzada. Consulte con el proveedor.');
    }

    if (clientCount <= 0 || isNaN(clientCount) || hoursSending <= 0 || isNaN(hoursSending)) {
        throw new Error('Parámetro inválido: la cantidad de horas o clientes debe ser un número mayor a 0.');
    }

    for (let i = 0; i < clientCount; i++) {
        await addClient(mainWindow);
    }

    startMessageExchange(minTime, maxRandTime, hoursSending, mainWindow);
    return true;

}

async function addClient(mainWindow) {

    if (new Date() > DEADLINE_DATE) {
        throw new Error('No se puede ejecutar: Fecha límite alcanzada. Consulte con el proveedor.');
    }

    const clientIndex = clientsData.length;

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `client-${clientIndex}`,
        }),
        puppeteer: {
            executablePath: puppeteer.executablePath(),
        }
    });

    console.log(`Nuevo cliente creado: client-${clientIndex}`);

    client.on('qr', async (qr) => {
        console.log("QR event para nuevo cliente");
        const err = await handleQrEvent(qr, clientIndex, mainWindow);
        if (err) throw new Error(`Error al generar QR: ${err}`);
    });

    client.on('ready', async () => {
        await handleReadyEvent(client, mainWindow);
        console.log(`Cliente listo: client-${clientIndex}`);
    });

    await client.initialize();
    await new Promise(resolve => client.on('ready', resolve));

    return true;

}

async function handleQrEvent(qr, i, mainWindow) {
    console.log("Inside qr handler event");
    return new Promise((resolve, reject) => {
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.log('Error generando QR:', err);
                reject(err);
                return;
            }
            console.log(`QR generado para cliente ${i}`);
            mainWindow.webContents.send('qr', { qr: url, clientIndex: i });
            resolve();
        });
    });
}

async function handleReadyEvent(client, mainWindow) {

    const phoneNumber = client.info.wid.user;

    const clientData = { phoneNumber, isReady: true, };

    clientsData.push({ client, phoneNumber, isReady: true, });

    const contact = await checkContact(phoneNumber);

    mainWindow.webContents.send('ready', { clientData, contact });
}

async function startMessageExchange(MIN_TIME, MAX_RAND_TIME, hoursSending, mainWindow) { //En segundos

    const sendUntil = getSendUntilDate(hoursSending);

    while (true) {
        for (const sender of clientsData) {

            if (Date.now() > sendUntil.getTime()) {
                mainWindow.webContents.send('onFinishedSendingMessage');
                return;
            }

            if (!sender.isReady) continue;

            const recipient = getRandomRecipient(sender.phoneNumber);


            if (recipient) {

                const senderNumber = sender.phoneNumber;
                const receiverNumber = recipient.phoneNumber;

                const randomWord = randomWords.phrases[Math.floor(Math.random() * randomWords.phrases.length)];

                try {
                    await sender.client.sendMessage(`${receiverNumber}@c.us`, randomWord);
                    await updateMessages(senderNumber, receiverNumber);
                    mainWindow.webContents.send('onSendingMessage', { senderNumber, receiverNumber });
                    console.log(`Mensaje enviado de ${senderNumber} a ${receiverNumber}: ${randomWord}`);
                } catch (error) {
                    console.log('Error al enviar el mensaje', error);
                }
            }
            const interval = Math.floor(MIN_TIME * 1000 + Math.random() * (MAX_RAND_TIME - MIN_TIME) * 1000);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }
}

function getRandomRecipient(senderPhoneNumber) {
    const potentialRecipients = clientsData.filter(
        (recipient) => recipient.phoneNumber !== senderPhoneNumber && recipient.isReady
    );

    if (potentialRecipients.length === 0) return null;

    return potentialRecipients[Math.floor(Math.random() * potentialRecipients.length)];
}

async function logoutAllClients() {
    console.log('Iniciando cierre de sesiones...');

    await Promise.all(clientsData.map(async (clientData) => {
        try {
            await clientData.client.logout();
            console.log(`Sesión cerrada para ${clientData.phoneNumber}`);
        } catch (err) {
            console.log(`Error cerrando sesión para ${clientData.phoneNumber}:`, err);
        }
    }));


    try {
        await Promise.all([
            fs.promises.rm(path.join(__dirname, '.wwebjs_auth'), { recursive: true, force: true }),
            fs.promises.rm(path.join(__dirname, '.wwebjs_cache'), { recursive: true, force: true })
        ]);
        console.log('Archivos de autenticación eliminados correctamente.');
    } catch (error) {
        console.log(`Error intentando borrar los archivos de autenticación: ${error}`);
    }

    // Limpiar la lista de clientes
    clientsData = [];
    console.log('Todas las sesiones han sido cerradas.');
}

async function logoutClient(phoneNumber) {

    const clientIndex = clientsData.findIndex(c => c.phoneNumber === phoneNumber);
    if (clientIndex === -1) {
        console.log(`Cliente con número ${phoneNumber} no encontrado.`);
        return false;
    }

    const clientData = clientsData[clientIndex];

    try {
        await clientData.client.logout();
        console.log(`Sesión cerrada para ${phoneNumber}`);
    } catch (err) {
        console.log(`Error cerrando sesión para ${phoneNumber}:`, err);
    }

    clientsData.splice(clientIndex, 1);
    console.log(`Cliente con número ${phoneNumber} eliminado correctamente.`);

    return true;
}

function getSendUntilDate(hours) {
    return new Date(Date.now() + (hours * 60 * 60 * 1000)); // Se le suma las horas dadas
}

module.exports = {
    initializeClients,
    logoutAllClients,
    addClient,
    logoutClient
}
