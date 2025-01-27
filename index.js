import fs from 'fs'; 
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal'


const MIN_TIME = 60000;//1 minuto en ms
const MAX_RAND_TIME = 600000; //10 minutos en ms

const randomWords = JSON.parse(fs.readFileSync('randomWords.json', 'utf8'));

let clientsData = [];

async function initializeClients(clientCount) {
    for (let i = 0; i < clientCount; i++) {
        console.log(`Inicializando cliente ${i + 1}...`);
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: `client-${i}`
            })
        });
        // Manejar el QR
        client.on('qr', (qr) => {
            console.log(`QR para cliente ${i + 1}:`);
            qrcode.generate(qr, {small: true});
        });

        client.initialize();

        // Manejar el evento de "ready"
        await new Promise((resolve) => {
            client.on('ready', () => {
                console.log(`Cliente ${i + 1} listo.`);

                const phoneNumber = client.info.wid.user;
                console.log(phoneNumber);
                clientsData.push({
                    client,
                    phoneNumber: phoneNumber,
                    isReady: true,
                });

                resolve();
            });
        });

    }
    console.log('Todos los clientes han sido inicializados.');
    startMessageExchange();
}

// Función para elegir un destinatario aleatorio (que no sea el mismo cliente)
function getRandomRecipient(senderPhoneNumber) {
    const potentialRecipients = clientsData.filter(
        (recipient) => recipient.phoneNumber !== senderPhoneNumber && recipient.isReady
    );
    if (potentialRecipients.length === 0) return null;
    return potentialRecipients[Math.floor(Math.random() * potentialRecipients.length)];
}

async function startMessageExchange() {
    while(true) {
        for(const sender of clientsData) {

            //Asegura de que no haya ningun error en los clientes
            if(!sender.isReady) continue;

            const recipient = getRandomRecipient(sender.phoneNumber);

            if(recipient) {

                const randomWord = randomWords.phrases[Math.floor(Math.random() * randomWords.phrases.length)]

                try {
                    await sender.client.sendMessage(`${recipient.phoneNumber}@c.us`, randomWord);
                    console.log(`Mensaje enviado de ${sender.phoneNumber} a ${recipient.phoneNumber}: ${randomWord}`);
                } catch (error) {
                    console.error('Error al enviar el mensaje', error);
                }

            }

            // Esperar un intervalo aleatorio antes de pasar al siguiente cliente
            const interval = Math.random() * MAX_RAND_TIME + MIN_TIME;
            await new Promise(resolve => setTimeout(resolve, interval));

        }
    }
}

// Función para hacer logout de todos los clientes
async function logoutAllClients() {
    console.log('Cerrando sesiones de todos los clientes...');
    for (const clientData of clientsData) {
        try {
            await clientData.client.logout();
            console.log(`Sesión cerrada para ${clientData.phoneNumber}`);
        } catch (err) {
            console.error(`Error cerrando sesión para ${clientData.phoneNumber}:`, err);
        }
    }
    console.log('Todas las sesiones han sido cerradas.');
}

// Registrar eventos para limpiar antes de salir
process.on('SIGINT', async () => {
    console.log('Interrupción detectada (SIGINT). Finalizando...');
    await logoutAllClients();
    process.exit(0); // Salir del programa
});

process.on('exit', async () => {
    console.log('Saliendo del programa. Finalizando sesiones...');
    await logoutAllClients();
});
