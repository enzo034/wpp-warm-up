const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { checkContact, updateMessages } = require('./data/database.js')
const puppeteer = require('puppeteer')

const logStream = fs.createWriteStream('app.log', { flags: 'a' }); // Abre el archivo en modo append

// Redirigir console.log a un archivo
console.log = function (message) {
    logStream.write(new Date().toISOString() + ' - ' + message + '\n');
};


const randomWords = {
    phrases: [
        "Hola, ¿cómo estás?",
        "¡Buenos días!",
        "¿Qué tal tu día?",
        "Espero que tengas una excelente semana.",
        "Nos vemos pronto.",
        "¡Qué interesante!",
        "Estoy aquí si necesitas algo.",
        "¿A qué hora nos conectamos?",
        "No olvides revisar los mensajes.",
        "Gracias por tu ayuda.",
        "¡Qué sorpresa!",
        "Cuéntame más sobre eso.",
        "¿Qué opinas de esto?",
        "Me parece una buena idea.",
        "¡Eso es genial!",
        "¿Te gustaría hacer algo hoy?",
        "Estoy de acuerdo contigo.",
        "¡Nos mantenemos en contacto!",
        "¿Ya viste las noticias?",
        "¡Disfruta tu día!",
        "Es un día perfecto para empezar algo nuevo.",
        "Confío en que todo saldrá bien.",
        "Recuerda tomar un descanso.",
        "Hablemos pronto.",
        "¡Hola! ¿Cómo te va?",
        "¿Todo bien por allá?",
        "Oye, ¿has visto esta película?",
        "Me alegra saber que estás bien.",
        "¡Te mando un abrazo!",
    ]
}
let clientsData = [];

const DEADLINE_DATE = new Date('2025-02-20T00:00:00');

async function initializeClients(clientCount, mainWindow, hoursSending, minTime = 60, maxRandTime = 600) {

    try {
        if (new Date() > DEADLINE_DATE) {
            return 'No se puede ejecutar: Fecha límite alcanzada. Consulte con el proveedor.';
        }
    
        if (clientCount <= 0 || isNaN(clientCount)) return false;
    
        for (let i = 0; i < clientCount; i++) {
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: `client-${i}`,
                }),
                puppeteer: {
                    executablePath: puppeteer.executablePath()
                }
            });
            console.log("Client created");
            client.on('qr', async (qr) => {
                console.log("QR event");
                const err = await handleQrEvent(qr, i, mainWindow);
                if (err) return `An error has occurred. ${err}`
            });
    
            client.on('ready', async () => {
                await handleReadyEvent(client, mainWindow)
            });
    
            client.initialize();
            await new Promise(resolve => client.on('ready', resolve));
        }
    
        startMessageExchange(minTime, maxRandTime, hoursSending, mainWindow);
        return true;
    } catch (error) {
        console.log(error);
        return `An error has occurred. ${error}`
    }
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

    // Ruta correcta de almacenamiento de sesiones
    const basePath = path.dirname(process.execPath);
    const authPath = path.join(basePath, '.wwebjs_auth');
    const cachePath = path.join(basePath, '.wwebjs_cache');

    try {
        await Promise.all([
            fs.promises.rm(authPath, { recursive: true, force: true }),
            fs.promises.rm(cachePath, { recursive: true, force: true })
        ]);
        console.log('Archivos de autenticación eliminados correctamente.');
    } catch (error) {
        console.log(`Error intentando borrar los archivos de autenticación: ${error}`);
    }

    // Limpiar la lista de clientes
    clientsData = [];
    console.log('Todas las sesiones han sido cerradas.');
}


function getSendUntilDate(hours) {
    return new Date(Date.now() + (hours * 60 * 60 * 1000)); // Se le suma las horas dadas
}

module.exports = {
    initializeClients,
    logoutAllClients
}
