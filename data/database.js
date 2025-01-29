const Loki = require('lokijs');


const db = new Loki('database.json', {

    autosave: true,
    autosaveInterval: 5000,
    autoload: true,
    autoloadCallback: () => {
        initDb();
        console.log("Base de datos cargada correctamente.");
    }

});

function initDb() {
    let contacts = db.getCollection('contacts');

    if (!contacts) {
        contacts = db.addCollection('contacts', { indices: ['phoneNumber'] });
        db.saveDatabase();
    }
}

// Asegura que la base de datos esté lista antes de operar
async function ensureDbLoaded() {
    return new Promise(resolve => {
        if (db.persistenceAdapter) resolve();
        db.on('loaded', resolve);
    });
}

async function checkContact(phoneNumber) {

    await ensureDbLoaded();

    const contacts = db.getCollection('contacts');

    let contact = contacts.findOne({ phoneNumber });

    if (!contact) {

        const firstLastScan = new Date();

        contact = contacts.insert({
            phoneNumber,
            firstScan: firstLastScan,
            lastScan: firstLastScan,
            messagesSent: 0,
            messagesReceived: 0
        });

    } else {
        contact.lastScan = new Date();
        contacts.update(contact);
    }

    db.saveDatabase();

    return contact;
}

async function updateMessages(phoneSender, phoneReceiver) {
    await ensureDbLoaded();

    const contacts = db.getCollection('contacts');

    let sender = contacts.findOne({ phoneNumber: phoneSender });
    let receiver = contacts.findOne({ phoneNumber: phoneReceiver });

    if (!sender || !receiver) {
        console.error('No se encontró el contacto de uno de los usuarios.');
        return;
    }

    sender.messagesSent += 1;
    receiver.messagesReceived += 1;

    contacts.update([sender, receiver]);

    db.saveDatabase();
}

module.exports = {
    db,
    checkContact,
    updateMessages
};