const startButton = document.getElementById('start-clients');
const logoutButton = document.getElementById('logout-clients');
const qrContainer = document.getElementById('qr-container');

startButton.addEventListener('click', async () => {
    const clientCount = parseInt(document.getElementById('client-count').value);

    if (isNaN(clientCount) || clientCount <= 0) {
        alert('Por favor, ingrese un número válido de clientes.');
        return;
    }
    const result = await electronAPI.initializeClients(clientCount);
    alert(result);
});

electronAPI.onQRGenerated((event, { qr, clientIndex }) => {
    deleteQrChilds();
    const qrImage = document.createElement('img');
    qrImage.src = qr;
    qrImage.alt = `QR para cliente ${clientIndex + 1}`;
    qrContainer.appendChild(qrImage);
});

electronAPI.onReady((event, { clientData }) => {
    deleteQrChilds();
    console.log(clientData);
})

logoutButton.addEventListener('click', async () => {
    const result = await electronAPI.logoutClients();
    alert(result);
});

function deleteQrChilds() {
    while (qrContainer.firstChild) {
        qrContainer.removeChild(qrContainer.firstChild);
    }
}
