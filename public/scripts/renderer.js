const startButton = document.getElementById('start-clients');
const logoutButton = document.getElementById('logout-clients');
const qrContainer = document.getElementById('qr-container');
const statusList = document.getElementById("status-list");

startButton.addEventListener('click', async () => {
    const clientCount = parseInt(document.getElementById('client-count').value);
    let minTime = parseInt(document.getElementById('min-delay').value);
    let maxRandTime = parseInt(document.getElementById('max-delay').value);
    let hoursSending = parseInt(document.getElementById('hours-sending').value);

    // Para que los tome como undefined en lugar de NaN
    minTime = isNaN(minTime) ? undefined : minTime;
    maxRandTime = isNaN(maxRandTime) ? undefined : maxRandTime;

    const validation = validateWarmUpParameters(clientCount, minTime, maxRandTime, hoursSending);
    if (!validation) {
        alert('Asegurese de que todos los parametros estén correctos antes de comenzar.');
        return;
    }

    qrContainer.innerHTML = `
    <div class="qr-wrapper">
        <span class="loader"></span>
    </div>
    `

    const result = await electronAPI.initializeClients(clientCount, hoursSending, minTime, maxRandTime);
    alert(result);
});


logoutButton.addEventListener('click', async () => {
    const result = await electronAPI.logoutClients();

    while (statusList.firstChild) {
        statusList.removeChild(statusList.firstChild);
    }

    alert(result);
});


//! Electron Events
electronAPI.onQRGenerated((event, { qr, clientIndex }) => {
    deleteQrChilds();

    const qrWrapper = document.createElement("div");
    qrWrapper.classList.add("qr-wrapper");

    const qrText = document.createElement("p");
    qrText.textContent = `QR para cliente ${clientIndex + 1}`;
    qrText.classList.add("qr-text");

    const qrImage = document.createElement("img");
    qrImage.src = qr;
    qrImage.alt = qrText.textContent;

    qrWrapper.appendChild(qrText);
    qrWrapper.appendChild(qrImage);

    qrContainer.appendChild(qrWrapper);
});


electronAPI.onReady((event, { clientData, contact }) => {
    deleteQrChilds();

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString("es-ES", { timeZoneName: "short" });
    };
    

    const clientBox = document.createElement("div");
    clientBox.classList.add("client-box");
    clientBox.classList.add(clientData.isReady ? "ready" : "not-ready");

    clientBox.innerHTML = `
        <strong>${clientData.phoneNumber} - ${clientData.isReady ? "Conectado" : "Desconectado"}</strong><br>
        <small>📅 Primer escaneo: ${formatDate(contact.firstScan)}</small><br>
        <small>⏳ Último escaneo: ${formatDate(contact.lastScan)}</small><br>
        <small>✉️ Mensajes enviados: ${contact.messagesSent}</small><br>
        <small>✉️ Mensajes recibidos: ${contact.messagesReceived}</small>
    `;

    statusList.appendChild(clientBox);

});

electronAPI.onFinishedSendingMessage(() => {
    alert('El envío de mensajes fue finalizado');
});

electronAPI.onSendingMessage((event, { senderNumber, receiverNumber }) => {
    for (const child of statusList.childNodes) {

        if (child.innerText.includes(senderNumber)) {

            const sentMessagesText = child.innerText.match(/Mensajes enviados: (\d+)/);
            if (sentMessagesText) {
                const sentMessagesCount = parseInt(sentMessagesText[1], 10);
                child.innerHTML = child.innerHTML.replace(`Mensajes enviados: ${sentMessagesCount}`, `Mensajes enviados: ${sentMessagesCount + 1}`);
            }
        }

        if (child.innerText.includes(receiverNumber)) {

            const receivedMessagesText = child.innerText.match(/Mensajes recibidos: (\d+)/);
            if (receivedMessagesText) {
                const receivedMessagesCount = parseInt(receivedMessagesText[1], 10);

                child.innerHTML = child.innerHTML.replace(`Mensajes recibidos: ${receivedMessagesCount}`, `Mensajes recibidos: ${receivedMessagesCount + 1}`);
            }
        }
    }
});


//! End events



//! Helpers
function deleteQrChilds() {
    while (qrContainer.firstChild) {
        qrContainer.removeChild(qrContainer.firstChild);
    }
}

function validateWarmUpParameters(clientCount, minTime, maxRandTime, hoursSending) {
    if (isNaN(clientCount) || clientCount <= 0) {
        alert(`Por favor, ingrese un número válido de clientes`);
        return false;
    }

    if (minTime < 0 || maxRandTime < 0) {
        alert(`Por favor, ingrese intervalos válidos`);
        return false;
    }

    if (minTime > maxRandTime) {
        alert(`Por favor, ingrese un numero de intervalo minimo menor al intervalo máximo`);
        return false;
    }

    if (hoursSending <= 0) {
        alert(`Por favor, ingrese un horario válido para el envio de mensajes`);
        return false;
    }

    return true;
}
//! End helpers