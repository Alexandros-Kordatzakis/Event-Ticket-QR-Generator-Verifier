/*
script.js
Author: Alexandros Kordatzakis
Created: 2025
*/

// In-memory CSV data loaded from tickets.csv (for verification)
let ticketDatabase = "";
let lastGeneratedTicket = null;
let html5QrcodeScanner = null;
let html5QrcodeAdminScanner = null;
let auditLog = [];
const ADMIN_PIN = "2050"; // YES, I know this is public.

/* ===================== MAIN PAGE ===================== */

/* ----- Load Static CSV Database (for verification) ----- */
function loadDatabase() {
  fetch("tickets.csv")
    .then(response => response.text())
    .then(data => {
      ticketDatabase = data;
      updateTicketList();
    })
    .catch(error => {
      console.error("Error loading tickets.csv:", error);
      ticketDatabase = "Ticket ID,Name,Attended\n";
      updateTicketList();
    });
}

/* ----- Update Display of Ticket Database & Counter ----- */
function updateTicketList() {
  const rows = ticketDatabase.trim().split('\n');
  const counterEl = document.getElementById('databaseCounter');
  if (rows.length <= 1) {
    document.getElementById('ticketList').innerHTML = "<p>No tickets available.</p>";
    counterEl.textContent = "Total Tickets: 0, Attendees: 0";
    return;
  }
  let tableHTML = "<table><thead><tr><th>Ticket ID</th><th>Name</th><th>Attended</th></tr></thead><tbody>";
  let total = rows.length - 1;
  let attendedCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const [ticketId, name, attended] = rows[i].split(',');
    if (attended === 'true') attendedCount++;
    tableHTML += `<tr>
      <td>${ticketId}</td>
      <td>${name}</td>
      <td>${attended === 'true' ? "Yes" : "No"}</td>
    </tr>`;
  }
  tableHTML += "</tbody></table>";
  document.getElementById('ticketList').innerHTML = tableHTML;
  counterEl.textContent = `Total Tickets: ${total}, Attendees: ${attendedCount}`;
}

/* ----- Generate QR Code ----- */
function generateQR() {
  const ticketIdInput = document.getElementById('ticketId');
  const nameInput = document.getElementById('attendeeName');
  const ticketId = ticketIdInput.value.trim();
  const name = nameInput.value.trim();

  if (!ticketId || !name) {
    alert("Please fill in both fields!");
    return;
  }

  const qrData = JSON.stringify({ ticketId, name });
  lastGeneratedTicket = { ticketId, name };

  document.getElementById('qrcode').innerHTML = '';
  document.getElementById('saveQRButton').style.display = 'none';

  new QRCode(document.getElementById('qrcode'), {
    text: qrData,
    width: 200,
    height: 200
  });

  document.getElementById('saveQRButton').style.display = 'block';
  ticketIdInput.value = '';
  nameInput.value = '';
}

/* ----- Save QR Code as Image ----- */
function saveQR() {
  const qrElement = document.getElementById('qrcode');
  const canvas = qrElement.querySelector('canvas');
  if (!canvas) {
    alert("No QR code generated yet!");
    return;
  }
  const { ticketId, name } = lastGeneratedTicket;
  const image = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = image;
  link.download = `${name}_${ticketId}_QR.png`;
  link.click();
}

/* ----- Start QR Code Scanner ----- */
function startScanner() {
  document.getElementById('verificationResult').innerHTML = "";
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
  }
  html5QrcodeScanner = new Html5QrcodeScanner(
    "qr-reader", { fps: 10, qrbox: 250 }
  );
  html5QrcodeScanner.render(onScanSuccess, onScanError);
}

function onScanSuccess(decodedText) {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
    html5QrcodeScanner = null;
  }

  try {
    const ticketData = JSON.parse(decodedText);
    const resultDiv = document.getElementById('verificationResult');
    verifyTicketData(ticketData, resultDiv);
  } catch (e) {
    document.getElementById('verificationResult').innerHTML = "❌ Invalid QR format!";
    document.getElementById('verificationResult').className = "result invalid";
  }
}

function onScanError(errorMessage) {
  console.warn("Scan error:", errorMessage);
}

/* ----- Verify Ticket Data ----- */
function verifyTicketData(ticketData, resultDiv) {
  const rows = ticketDatabase.trim().split('\n');
  let found = false;
  let logMessage = "";

  for (let i = 1; i < rows.length; i++) {
    const [dbTicketId, dbName, attended] = rows[i].split(',');
    if (dbTicketId === ticketData.ticketId && dbName === ticketData.name) {
      found = true;
      if (attended === 'false') {
        rows[i] = `${dbTicketId},${dbName},true`;
        resultDiv.innerHTML = "✅ Valid ticket! Attendee marked as attended.";
        resultDiv.className = "result valid";
        logMessage = "Ticket verified successfully.";
      } else {
        resultDiv.innerHTML = "⚠️ Ticket already used!";
        resultDiv.className = "result used";
        logMessage = "Ticket already used.";
      }
      break;
    }
  }

  if (!found) {
    resultDiv.innerHTML = "❌ Ticket not found in the database!";
    resultDiv.className = "result invalid";
    logMessage = "Ticket not found.";
  }

  ticketDatabase = rows.join('\n');
  updateTicketList();
  logAudit("verify", ticketData, logMessage);
}

/* ----- Manual Ticket Verification ----- */
function verifyTicketManual() {
  const ticketId = document.getElementById('manualTicketId').value.trim();
  const name = document.getElementById('manualAttendeeName').value.trim();
  const resultDiv = document.getElementById('manualVerificationResult');
  if (!ticketId || !name) {
    resultDiv.innerHTML = "Please fill in both fields for manual verification!";
    resultDiv.className = "result invalid";
    return;
  }
  const ticketData = { ticketId, name };
  verifyTicketData(ticketData, resultDiv);
}

/* ----- Toggle Manual Verification Display ----- */
function toggleManualVerification() {
  const container = document.getElementById('manual-verification-container');
  const toggleBtn = document.getElementById('toggleManualBtn');
  if (container.style.display === 'none' || container.style.display === '') {
    container.style.display = 'block';
    toggleBtn.innerText = 'Hide Manual Verification';
  } else {
    container.style.display = 'none';
    toggleBtn.innerText = 'Show Manual Verification';
  }
}

/* ----- Export CSV Database ----- */
function exportCSV() {
  const blob = new Blob([ticketDatabase], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ticket_database.csv';
  link.click();
}

/* ----- Export Audit Log ----- */
function exportAuditLog() {
  let csv = "Timestamp,Action,Ticket ID,Name,Message\n";
  auditLog.forEach(entry => {
    csv += `${entry.timestamp},${entry.action},${entry.ticketData.ticketId},${entry.ticketData.name},${entry.message}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'audit_log.csv';
  link.click();
}

/* ----- Reload Database ----- */
function resetDatabase() {
  if (confirm("Reload the static database? All unsaved changes will be lost.")) {
    loadDatabase();
  }
}

/* ===================== ADMIN PAGE ===================== */

/* ----- PIN Verification ----- */
function checkAdminPIN() {
  const enteredPIN = document.getElementById('adminPin').value;
  if (enteredPIN === ADMIN_PIN) {
    document.getElementById('pin-section').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    loadAdminDashboard();
  } else {
    document.getElementById('pinError').innerText = "Incorrect PIN!";
  }
}

/* ----- Load Admin Dashboard ----- */
function loadAdminDashboard() {
  fetch("tickets.csv")
    .then(response => response.text())
    .then(data => {
      ticketDatabase = data;
      renderAdminTable();
    })
    .catch(error => {
      console.error("Error loading tickets.csv:", error);
      ticketDatabase = "Ticket ID,Name,Attended\n";
      renderAdminTable();
    });
}

function renderAdminTable() {
  const rows = ticketDatabase.trim().split('\n');
  let tableHTML = "<table><thead><tr><th>Ticket ID</th><th>Name</th><th>Attended</th></tr></thead><tbody>";

  for (let i = 1; i < rows.length; i++) {
    const [ticketId, name, attended] = rows[i].split(',');
    tableHTML += `<tr>
      <td>${ticketId}</td>
      <td>${name}</td>
      <td>${attended === 'true' ? 'Yes' : 'No'}</td>
    </tr>`;
  }

  tableHTML += "</tbody></table>";
  document.getElementById('adminTicketList').innerHTML = tableHTML;
}

/* ----- Admin Search Functionality ----- */
function searchTickets() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const rows = ticketDatabase.trim().split('\n');
  let tableHTML = "<table><thead><tr><th>Ticket ID</th><th>Name</th><th>Attended</th></tr></thead><tbody>";

  for (let i = 1; i < rows.length; i++) {
    const [ticketId, name, attended] = rows[i].split(',');
    if (ticketId.toLowerCase().includes(query) || name.toLowerCase().includes(query)) {
      tableHTML += `<tr>
        <td>${ticketId}</td>
        <td>${name}</td>
        <td>${attended === 'true' ? 'Yes' : 'No'}</td>
      </tr>`;
    }
  }

  tableHTML += "</tbody></table>";
  document.getElementById('adminTicketList').innerHTML = tableHTML;
}


/* ----- Admin QR Code Scanner with Raw Data ----- */
function startAdminScanner() {
  document.getElementById('decodedQRData').innerText = "";

  if (html5QrcodeAdminScanner) {
    html5QrcodeAdminScanner.clear();
  }

  html5QrcodeAdminScanner = new Html5QrcodeScanner(
    "admin-qr-reader", { fps: 10, qrbox: 250 }
  );
  html5QrcodeAdminScanner.render(onAdminScanSuccess, onAdminScanError);
}

function onAdminScanSuccess(decodedText) {
  if (html5QrcodeAdminScanner) {
    html5QrcodeAdminScanner.clear();
    html5QrcodeAdminScanner = null;
  }

  let decodedData = `<strong>RAW QR Data:</strong><br><code>${decodedText}</code><br><br>`;
  try {
    const parsedData = JSON.parse(decodedText);
    decodedData += `<strong>Extracted Data:</strong><br>
                    Ticket ID: ${parsedData.ticketId}<br>
                    Name: ${parsedData.name}<br>`;
  } catch (e) {
    decodedData += "<strong>Extracted Data:</strong><br>Could not parse JSON.";
  }

  document.getElementById('decodedQRData').innerHTML = decodedData;
  logAudit("admin-scan", { ticketId: decodedText, name: "" }, "Scanned in Admin");
}

function onAdminScanError(errorMessage) {
  console.warn("Admin Scan Error:", errorMessage);
}

/* ===================== NAVIGATION ===================== */

/* ----- Navigation Between Pages ----- */
function goToAdmin() {
  window.location.href = "admin.html";
}

function goToMain() {
  window.location.href = "index.html";
}

/* ----- Initialize on Page Load ----- */
document.addEventListener('DOMContentLoaded', () => {
  loadDatabase();
});
