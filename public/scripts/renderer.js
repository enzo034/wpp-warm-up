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
    minTime = isNaN(minTime) ? undefined : parseInt(minTime);
    maxRandTime = isNaN(maxRandTime) ? undefined : parseInt(maxRandTime);

    const validation = validateWarmUpParameters(clientCount, minTime, maxRandTime, hoursSending);
    if(!validation) {
        alert('Asegurese de que todos los parametros estén correctos antes de comenzar.');
        return;
    }

    const result = await electronAPI.initializeClients(clientCount, hoursSending, minTime, maxRandTime);
    alert(result);
});


logoutButton.addEventListener('click', async () => {
    const result = await electronAPI.logoutClients();

    while(statusList.firstChild) {
        statusList.removeChild(statusList.firstChild);
    }

    alert(result);
});


//! Electron Events
electronAPI.onQRGenerated((event, { qr, clientIndex }) => {
    deleteQrChilds();
    const qrImage = document.createElement('img');
    qrImage.src = qr;
    qrImage.alt = `QR para cliente ${clientIndex + 1}`;
    qrContainer.appendChild(qrImage);
});

electronAPI.onReady((event, { clientData }) => {
    deleteQrChilds(); // Función que limpia los QR (si es necesaria)

    // Crear un nuevo div para este cliente
    const clientBox = document.createElement("div");
    clientBox.classList.add("client-box");
    clientBox.classList.add(clientData.isReady ? "ready" : "not-ready");

    // Texto con el número y estado
    clientBox.textContent = `${clientData.phoneNumber} - ${clientData.isReady ? "Conectado" : "Desconectado"}`;

    // Agregar al contenedor
    statusList.appendChild(clientBox);
});

electronAPI.onFinishedSendingMessage(() => {
    alert('El envío de mensajes fue finalizado');
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

    if(minTime < 0 || maxRandTime < 0) {
        alert(`Por favor, ingrese intervalos válidos`);
        return false;
    }

    if(minTime > maxRandTime) {
        alert(`Por favor, ingrese un numero de intervalo minimo menor al intervalo máximo`);
        return false;
    }

    if(hoursSending <= 0){
        alert(`Por favor, ingrese un horario válido para el envio de mensajes`);
        return false;
    }

    return true;
}
//! End helpers