const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { checkContact, updateMessages } = require('./data/database.js')

const randomWords = JSON.parse(fs.readFileSync('randomWords.json', 'utf8'));
let clientsData = [];

const DEADLINE_DATE = new Date('2025-02-20T00:00:00');

async function initializeClients(clientCount, mainWindow, hoursSending, minTime = 60, maxRandTime = 600) {

    if (new Date() > DEADLINE_DATE) {
        return 'No se puede ejecutar: Fecha límite alcanzada. Consulte con el proveedor.';
    }

    if (clientCount <= 0 || isNaN(clientCount)) return false;

    for (let i = 0; i < clientCount; i++) {
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `client-${i}`,
            }),
        });

        client.on('qr', (qr) => {
            qrcode.toDataURL(qr, (err, url) => { //Se envia como imagen para que el cliente pueda mostrar el qr
                if (err) {
                    console.error('Error generando QR:', err);
                    return;
                }
                console.log(qr);
                mainWindow.webContents.send('qr', { qr: url, clientIndex: i });
            });
        });

        client.on('ready', async () => {
            console.log(`Cliente ${i + 1} listo.`);

            const phoneNumber = client.info.wid.user;

            const clientData = { phoneNumber, isReady: true, };

            clientsData.push({ client, phoneNumber, isReady: true, });

            const contact = await checkContact(phoneNumber);

            mainWindow.webContents.send('ready', { clientData, contact });
        });

        client.initialize();
        await new Promise(resolve => client.on('ready', resolve));
    }

    startMessageExchange(minTime, maxRandTime, hoursSending, mainWindow);
    return true;
}

function getRandomRecipient(senderPhoneNumber) {
    const potentialRecipients = clientsData.filter(
        (recipient) => recipient.phoneNumber !== senderPhoneNumber && recipient.isReady
    );

    if (potentialRecipients.length === 0) return null;

    return potentialRecipients[Math.floor(Math.random() * potentialRecipients.length)];
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
                    console.error('Error al enviar el mensaje', error);
                }
            }
            const interval = Math.floor(MIN_TIME * 1000 + Math.random() * (MAX_RAND_TIME - MIN_TIME) * 1000);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }
}

async function logoutAllClients() {
    for (const clientData of clientsData) {
        try {
            await clientData.client.logout();
            console.log(`Sesión cerrada para ${clientData.phoneNumber}`);
        } catch (err) {
            console.error(`Error cerrando sesión para ${clientData.phoneNumber}:`, err);
        }
    }

    await fs.promises.rm(path.join(__dirname, '.wwebjs_auth'), { recursive: true, force: true });
    await fs.promises.rm(path.join(__dirname, '.wwebjs_cache'), { recursive: true, force: true });

    console.log('Todas las sesiones han sido cerradas.');
}

function getSendUntilDate(hours) {
    return new Date(Date.now() + (hours * 60 * 60 * 1000)); // Se le suma las horas dadas
}

module.exports = {
    initializeClients,
    logoutAllClients
}
