const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { updateMessages, addSenderClient, addReceivingClient } = require('./data/database.js')
const puppeteer = require('puppeteer');
const { randomWordsFromJs } = require('./randomWords.js');


/*
const logStream = fs.createWriteStream('app.log', { flags: 'a' });

console.log = function (message) {
    logStream.write(new Date().toISOString() + ' - ' + message + '\n');
}; */

const randomWords = randomWordsFromJs
let clientsData = [];
let shouldStopSending = false;

async function initializeClients(clientCount, mainWindow, hoursSending, minTime, maxRandTime) {

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

    const clientIndex = clientsData.length;

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: `client-${clientIndex}`,
        }),
        puppeteer: {
            executablePath: puppeteer.executablePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox']
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


async function addReceivingOnlyClient(phoneNumber, mainWindow) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('Número de teléfono inválido.');
    }

    const exists = clientsData.some(client => client.phoneNumber === phoneNumber);
    if (exists) {
        console.log(`El número ${phoneNumber} ya está registrado como cliente receptor.`);
        return false;
    }

    const clientData = { phoneNumber, isReady: true, };

    clientsData.push({
        phoneNumber,
        isReady: true,
        canSend: false
    });

    const contact = await addReceivingClient(phoneNumber);

    console.log(`Cliente receptor añadido: ${phoneNumber}`);

    mainWindow.webContents.send('ready', { clientData, contact });
    return true;
}


async function handleQrEvent(qr, i, mainWindow) {
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

    const clientData = { phoneNumber, isReady: true, canSend: true };

    clientsData.push({ client, phoneNumber, isReady: true, canSend: true });

    const contact = await addSenderClient(phoneNumber);

    mainWindow.webContents.send('ready', { clientData, contact });
}

function areAllReceptors() {
    let allReceptors = true;

    clientsData.forEach(client => {
        if (client.canSend) {
            allReceptors = false;
            return allReceptors;
        }
    });

    return allReceptors;
}

async function startMessageExchange(MIN_TIME, MAX_RAND_TIME, hoursSending, mainWindow) { //En segundos
    try {
        console.log("🟢 Iniciando startMessageExchange...");
        console.log("⏱️ Parámetros recibidos:", { MIN_TIME, MAX_RAND_TIME, hoursSending });

        const sendUntil = getSendUntilDate(hoursSending);
        console.log("📅 Envío permitido hasta:", sendUntil);

        shouldStopSending = false;

        if (clientsData.length === 0) {
            console.log("⚠️ No hay clientes disponibles para enviar mensajes.");
            return;
        }

        console.log(`✅ Hay ${clientsData.length} clientes disponibles.`);

        const areReceptors = areAllReceptors();
        if (areReceptors) {
            console.log('Todos los clientes son receptores de mensajes, no se puede comenzar a enviar.');
            return;
        }

        while (!shouldStopSending) {
            console.log("🔄 Iniciando ciclo while...");

            for (const sender of clientsData) {
                console.log("👤 Procesando cliente:", sender.phoneNumber);

                if (shouldStopSending) {
                    console.log("⛔ shouldStopSending es true, saliendo del bucle.");
                    break;
                }

                if (Date.now() > sendUntil.getTime()) {
                    console.log("⏰ Tiempo límite alcanzado, deteniendo envío de mensajes.");
                    mainWindow.webContents.send('onFinishedSendingMessage');
                    return;
                }

                if (!sender.isReady) {
                    console.log(`🚫 Cliente ${sender.phoneNumber} no está listo (isReady = false).`);
                    continue;
                }

                if (!sender.canSend) {
                    console.log(`🚫 Cliente ${sender.phoneNumber} no puede enviar (canSend = false).`);
                    const interval = Math.floor(MIN_TIME * 1000 + Math.random() * (MAX_RAND_TIME - MIN_TIME) * 1000);
                    console.log(`⏳ Esperando ${interval}ms antes de continuar...`);

                    await new Promise((resolve) => setTimeout(resolve, interval));
                    continue;
                }

                const recipient = getRandomRecipient(sender.phoneNumber);

                if (!recipient) {
                    console.log(`⚠️ No se encontró destinatario para el cliente ${sender.phoneNumber}.`);
                    continue;
                }

                const senderNumber = sender.phoneNumber;
                const receiverNumber = recipient.phoneNumber;

                console.log(`📨 Preparando mensaje de ${senderNumber} a ${receiverNumber}...`);

                const randomIndex = Math.floor(Math.random() * randomWords.phrases.length);
                const randomWord = randomWords.phrases[randomIndex];

                console.log(`📝 Mensaje seleccionado: "${randomWord}" (índice ${randomIndex})`);

                try {
                    await sender.client.sendMessage(`${receiverNumber}@c.us`, randomWord);
                    console.log(`✅ Mensaje enviado exitosamente de ${senderNumber} a ${receiverNumber}.`);

                    await updateMessages(senderNumber, receiverNumber);
                    console.log(`🗂️ Datos actualizados en la base de datos para ${senderNumber} -> ${receiverNumber}.`);

                    mainWindow.webContents.send('onSendingMessage', { senderNumber, receiverNumber });
                } catch (error) {
                    console.log(`❌ Error al enviar el mensaje de ${senderNumber} a ${receiverNumber}:`, error);
                }

                const interval = Math.floor(MIN_TIME * 1000 + Math.random() * (MAX_RAND_TIME - MIN_TIME) * 1000);
                console.log(`⏳ Esperando ${interval}ms antes de continuar...`);

                await new Promise((resolve) => setTimeout(resolve, interval));
            }

            console.log("🔁 Fin de iteración de for... comenzando siguiente si aplica.");
        }

        console.log("🚪 Salida del ciclo while completada.");

    } catch (error) {
        console.log("🔥 Error en startMessageExchange:", error);
    }
}

function stopMessageExchange() {
    shouldStopSending = true;
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
    logoutClient,
    startMessageExchange,
    stopMessageExchange,
    addReceivingOnlyClient
}
