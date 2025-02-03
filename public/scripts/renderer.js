const startButton = document.getElementById('start-clients');
const startSendingMessagesButton = document.getElementById('start-sending-messages');
const stopSendingMessagesButton = document.getElementById('stop-sending-messages');
const addClientButton = document.getElementById('add-client');
const logoutButton = document.getElementById('logout-clients');
const logoutClientButton = document.getElementById('logout-client-button');
const qrContainer = document.getElementById('qr-container');
const statusList = document.getElementById("status-list");

window.alert = function (str) {
    window.electronAPI.showAlert(str).then(() => {
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
            document.activeElement.focus();
        }
    });
};

startButton.addEventListener('click', async () => {
    const clientCount = parseInt(document.getElementById('client-count').value);
    let minTime = parseInt(document.getElementById('min-delay').value);
    let maxRandTime = parseInt(document.getElementById('max-delay').value);
    let hoursSending = parseInt(document.getElementById('hours-sending').value);

    const validation = validateWarmUpParameters(minTime, maxRandTime, hoursSending, clientCount);
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

startSendingMessagesButton.addEventListener('click', async () => {
    let minTime = parseInt(document.getElementById('min-delay').value);
    let maxRandTime = parseInt(document.getElementById('max-delay').value);
    let hoursSending = parseInt(document.getElementById('hours-sending').value);

    const validation = validateSendMessagesParameters(minTime, maxRandTime, hoursSending);
    if (!validation) {
        alert('Asegurese de que todos los parametros estén correctos antes de comenzar.');
        return;
    }

    const result = await electronAPI.startSendingMessages(minTime, maxRandTime, hoursSending);
    alert(result);
});

addClientButton.addEventListener('click', async () => {
    const result = await electronAPI.addSingleClient();
    alert(result);
})

logoutButton.addEventListener('click', async () => {
    const result = await electronAPI.logoutClients();

    while (statusList.firstChild) {
        statusList.removeChild(statusList.firstChild);
    }

    alert(result);
});

logoutClientButton.addEventListener('click', async () => {

    const logoutClientInput = document.getElementById('logout-client-number');
    const phoneNumber = logoutClientInput.value.trim();
    logoutClientInput.value = '';

    if (phoneNumber.length > 0) {
        let found = false;

        for (const child of statusList.childNodes) {
            if (child.innerText.includes(phoneNumber)) {
                found = true;
                const response = await electronAPI.logoutSingleClient(phoneNumber);
                child.remove();
                alert(response);
                break;
            }
        }

        if (!found) {
            alert(`El número ${phoneNumber} no fue encontrado.`);
        }
    } else {
        alert("Por favor, ingrese un número válido.");
    }

});

stopSendingMessagesButton.addEventListener('click', async () => {
    const result = await electronAPI.stopSendingMessages();
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
        <div class="client-header">
            <strong>${clientData.phoneNumber} - ${clientData.isReady ? "Conectado" : "Desconectado"}</strong>
        </div>
        <small>📅 Primer escaneo: ${formatDate(contact.firstScan)}</small><br>
        <small>⏳ Último escaneo: ${formatDate(contact.lastScan)}</small><br>
        <small>✉️ Mensajes enviados: ${contact.messagesSent}</small><br>
        <small>✉️ Mensajes recibidos: ${contact.messagesReceived}</small>
    `;

    clientBox.addEventListener("click", () => {
        navigator.clipboard.writeText(clientData.phoneNumber)
            .then(() => showToast())
            .catch(err => console.error("Error al copiar: ", err));
    });

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

function validateWarmUpParameters(minTime, maxRandTime, hoursSending, clientCount) {
    if (isNaN(clientCount) || clientCount <= 0) {
        alert(`Por favor, ingrese un número válido de clientes`);
        return false;
    }

    if (!minTime || !maxRandTime) {
        alert(`Asegurese de ingresar valores en el intervalo`);
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

    if (!hoursSending || hoursSending <= 0) {
        alert(`Por favor, ingrese un horario válido para el envio de mensajes`);
        return false;
    }

    return true;
}

function validateSendMessagesParameters(minTime, maxRandTime, hoursSending) {

    if (!minTime || !maxRandTime) {
        alert(`Asegurese de ingresar valores en el intervalo`);
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

    if (!hoursSending || hoursSending <= 0) {
        alert(`Por favor, ingrese un horario válido para el envio de mensajes`);
        return false;
    }

    return true;
}

function showToast() {
    const toast = document.getElementById("toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}
//! End helpers