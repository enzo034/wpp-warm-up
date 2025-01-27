const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const MIN_TIME = 60000; // 1 minuto en ms
const MAX_RAND_TIME = 600000; // 10 minutos en ms
const randomWords = JSON.parse(fs.readFileSync('randomWords.json', 'utf8'));

let clientsData = [];

async function initializeClients(clientCount, mainWindow) {
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

        client.on('ready', () => {
            console.log(`Cliente ${i + 1} listo.`);

            const phoneNumber = client.info.wid.user;

            // Se envian los datos que se pueden serializar
            const clientData = {
                phoneNumber,
                isReady: true,
            };

            clientsData.push({
                client,
                phoneNumber,
                isReady: true,
            });

            // Enviamos datos serializables al renderer
            mainWindow.webContents.send('ready', { clientData });
        });

        client.initialize();
        await new Promise((resolve) =>
            client.on('ready', resolve)
        );
    }
    console.log('Todos los clientes están inicializados.');
    startMessageExchange();
}

function getRandomRecipient(senderPhoneNumber) {
    const potentialRecipients = clientsData.filter(
        (recipient) => recipient.phoneNumber !== senderPhoneNumber && recipient.isReady
    );
    if (potentialRecipients.length === 0) return null;
    return potentialRecipients[Math.floor(Math.random() * potentialRecipients.length)];
}

async function startMessageExchange() {
    while (true) {
        for (const sender of clientsData) {
            if (!sender.isReady) continue;
            const recipient = getRandomRecipient(sender.phoneNumber);
            if (recipient) {
                const randomWord =
                    randomWords.phrases[
                    Math.floor(Math.random() * randomWords.phrases.length)
                    ];
                try {
                    await sender.client.sendMessage(
                        `${recipient.phoneNumber}@c.us`,
                        randomWord
                    );
                    console.log(
                        `Mensaje enviado de ${sender.phoneNumber} a ${recipient.phoneNumber}: ${randomWord}`
                    );
                } catch (error) {
                    console.error('Error al enviar el mensaje', error);
                }
            }
            const interval = Math.random() * MAX_RAND_TIME + MIN_TIME;
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

module.exports = {
    initializeClients,
    logoutAllClients
}
