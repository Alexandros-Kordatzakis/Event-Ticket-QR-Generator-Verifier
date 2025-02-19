// In-memory CSV data loaded from tickets.csv (for verification)
let ticketDatabase = "";
// For saving the QR image filename
let lastGeneratedTicket = null;
// For QR scanning
let html5QrcodeScanner = null;
// In-memory audit log array
let auditLog = [];

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

/* ----- Generate QR Code (using old JSON encryption) ----- */
function generateQR() {
  const ticketIdInput = document.getElementById('ticketId');
  const nameInput = document.getElementById('attendeeName');
  const ticketId = ticketIdInput.value.trim();
  const name = nameInput.value.trim();
  
  if (!ticketId || !name) {
    alert("Please fill in both fields!");
    return;
  }

  // Create data string as a JSON object
  const qrData = JSON.stringify({ ticketId, name });
  
  // Save ticket details for naming the QR image correctly
  lastGeneratedTicket = { ticketId, name };

  // Clear previous QR code and hide save button
  document.getElementById('qrcode').innerHTML = '';
  document.getElementById('saveQRButton').style.display = 'none';

  // Generate the QR code with the JSON string as text
  new QRCode(document.getElementById('qrcode'), {
    text: qrData,
    width: 200,
    height: 200
  });

  // Show the "Save QR Code" button
  document.getElementById('saveQRButton').style.display = 'block';

  // Clear input fields
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
  if (!lastGeneratedTicket || !lastGeneratedTicket.ticketId || !lastGeneratedTicket.name) {
    alert("Ticket details missing. Please generate a QR code first.");
    return;
  }
  const { ticketId, name } = lastGeneratedTicket;
  const image = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = image;
  link.download = `${name}_${ticketId}_QR.png`;
  link.click();
}

/* ----- Audit Logging ----- */
function logAudit(action, ticketData, message) {
  const timestamp = new Date().toLocaleString();
  auditLog.push({ timestamp, action, ticketData, message });
}

/* ----- Helper: Verify Ticket Data against the CSV Database ----- */
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

/* ----- Verify Ticket via Manual Input ----- */
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

/* ----- Start QR Code Scanner (using camera) ----- */
function startScanner() {
  document.getElementById('verificationResult').innerHTML = "";
  // If a scanner instance exists, clear it first
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
  }
  html5QrcodeScanner = new Html5QrcodeScanner(
    "qr-reader", { fps: 10, qrbox: 250 }
  );
  html5QrcodeScanner.render(onScanSuccess, onScanError);
}

function onScanSuccess(decodedText, decodedResult) {
  // Stop scanning after a successful scan
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

/* ----- Toggle Manual Verification Display ----- */
function toggleManualVerification() {
  const container = document.getElementById('manual-verification-container');
  const toggleBtn = document.getElementById('toggleManualBtn');
  if (container.style.display === "none") {
    container.style.display = "block";
    toggleBtn.textContent = "Hide Manual Verification";
  } else {
    container.style.display = "none";
    toggleBtn.textContent = "Show Manual Verification";
  }
}

/* ----- Export CSV Database (Verification Data) ----- */
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

/* ----- Reload Static CSV Database ----- */
function resetDatabase() {
  if (confirm("Reload the static database? All unsaved changes will be lost.")) {
    loadDatabase();
  }
}

/* ----- Initialize on Page Load ----- */
document.addEventListener('DOMContentLoaded', () => {
  loadDatabase();
});
