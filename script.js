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
const ADMIN_PIN_BASE64 = "MjA1MA=="; // Base64 encoded "2050"

/* ----- Audit Logging Function ----- */
function logAudit(action, ticketData, message) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ticketData,
    message
  };
  auditLog.push(entry);
}

/* ----- Local Storage Attendance Management ----- */
function loadAttendanceFromLocalStorage() {
  let data = localStorage.getItem("attendanceData");
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Error parsing localStorage attendanceData:", e);
      logAudit("localStorage-error", {}, "Error parsing attendanceData from localStorage.");
    }
  }
  return {};
}

function updateLocalAttendance() {
  // Parse ticketDatabase and update localStorage attendance data.
  let rows = ticketDatabase.trim().split('\n');
  let attendance = {};
  for (let i = 1; i < rows.length; i++) {
    let columns = rows[i].split(',');
    let ticketId = columns[0];
    let attended = columns[2] === 'true';
    attendance[ticketId] = attended;
  }
  localStorage.setItem("attendanceData", JSON.stringify(attendance));
  console.log("Local attendance data updated in localStorage.");
  logAudit("localStorage-update", {}, "Local attendance data updated.");
}

/* ===================== MAIN PAGE ===================== */

/* ----- Load Static CSV Database (for verification) ----- */
function loadDatabase() {
  console.log("Loading tickets.csv...");
  fetch("tickets.csv")
    .then(response => response.text())
    .then(data => {
      let rows = data.trim().split('\n');
      const attendanceData = loadAttendanceFromLocalStorage();
      for (let i = 1; i < rows.length; i++) {
        let columns = rows[i].split(',');
        let ticketId = columns[0];
        if (attendanceData.hasOwnProperty(ticketId)) {
          columns[2] = attendanceData[ticketId] ? 'true' : 'false';
        }
        rows[i] = columns.join(',');
      }
      ticketDatabase = rows.join('\n');
      console.log("tickets.csv loaded and attendance merged successfully.");
      logAudit("load-csv", {}, "CSV loaded and attendance merged successfully.");
      updateTicketList();
    })
    .catch(error => {
      console.error("Error loading tickets.csv:", error);
      ticketDatabase = "Ticket ID,Name,Attended,Email\n";
      logAudit("load-csv-error", {}, "Error loading CSV: " + error);
      updateTicketList();
    });
}

/* ----- Update Display of Ticket Database & Counter for Main Page ----- */
function updateTicketList() {
  // Main page does not display email
  const listEl = document.getElementById('ticketList');
  if (!listEl) {
    console.warn("ticketList element not found, skipping update.");
    return;
  }
  const rows = ticketDatabase.trim().split('\n');
  const counterEl = document.getElementById('databaseCounter');
  if (rows.length <= 1) {
    listEl.innerHTML = "<p>No tickets available.</p>";
    counterEl.textContent = "Total Tickets: 0, Attendees: 0";
    console.log("Ticket list updated: no tickets found.");
    return;
  }
  let tableHTML = "<table><thead><tr><th>Ticket ID</th><th>Name</th><th>Attended</th></tr></thead><tbody>";
  let total = rows.length - 1;
  let attendedCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const columns = rows[i].split(',');
    const ticketId = columns[0];
    const name = columns[1];
    const attended = columns[2];
    if (attended === 'true') attendedCount++;
    tableHTML += `<tr>
      <td>${ticketId}</td>
      <td>${name}</td>
      <td>${attended === 'true' ? "Yes" : "No"}</td>
    </tr>`;
  }
  tableHTML += "</tbody></table>";
  listEl.innerHTML = tableHTML;
  counterEl.textContent = `Total Tickets: ${total}, Attendees: ${attendedCount}`;
  console.log(`Ticket list updated: ${total} tickets found, ${attendedCount} attended.`);
}

/* ----- Generate QR Code (unchanged) ----- */
function generateQR() {
  const ticketIdInput = document.getElementById('ticketId');
  const nameInput = document.getElementById('attendeeName');
  const ticketId = ticketIdInput.value.trim();
  const name = nameInput.value.trim();

  if (!ticketId || !name) {
    alert("Please fill in both fields!");
    console.log("QR generation aborted: missing ticket ID or name.");
    return;
  }

  console.log(`Generating QR code for Ticket ID: ${ticketId}, Name: ${name}`);
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
  console.log("QR code generated successfully.");
  logAudit("generate-qr", { ticketId, name }, "QR code generated successfully.");
}

/* ----- Save QR Code as Image (unchanged) ----- */
function saveQR() {
  const qrElement = document.getElementById('qrcode');
  const canvas = qrElement.querySelector('canvas');
  if (!canvas) {
    alert("No QR code generated yet!");
    console.log("Save QR aborted: no QR code available.");
    return;
  }
  const { ticketId, name } = lastGeneratedTicket;
  console.log(`Saving QR code image for Ticket ID: ${ticketId}, Name: ${name}`);
  const image = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = image;
  link.download = `${name}_${ticketId}_QR.png`;
  link.click();
  console.log("QR code image saved successfully.");
  logAudit("save-qr", { ticketId, name }, "QR code image saved successfully.");
}

/* ----- Start QR Code Scanner (unchanged) ----- */
function startScanner() {
  console.log("Starting QR Code Scanner...");

  // Clear any old instance first
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(err => console.error("Clear error:", err));
    html5QrcodeScanner = null;
  }

  // Basic check for library
  if (typeof Html5QrcodeScanner === "undefined") {
    console.error("Html5QrcodeScanner is not loaded or undefined!");
    return;
  }

  // Start scanning
  document.getElementById('verificationResult').innerHTML = "";
  html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 60, qrbox: 250 });
  html5QrcodeScanner.render(
    function(decodedText, decodedResult) {
      console.log("Scan Success:", decodedText);
      onScanSuccess(decodedText); 
    },
    function(errorMessage) {
      console.warn("Scan Error:", errorMessage);
      onScanError(errorMessage);
    }
  );
}

function onScanSuccess(decodedText) {
  console.log("QR code scanned. Decoded text:", decodedText);
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
    console.error("Error parsing QR code data:", e);
  }
}

function onScanError(errorMessage) {
  console.warn("Scan error:", errorMessage);
}

/* ----- Verify Ticket Data (updated to preserve email if present & update localStorage) ----- */
function verifyTicketData(ticketData, resultDiv) {
  console.log("Verifying ticket data:", ticketData);
  const rows = ticketDatabase.trim().split('\n');
  let found = false;
  let logMessage = "";

  for (let i = 1; i < rows.length; i++) {
    const columns = rows[i].split(',');
    const dbTicketId = columns[0];
    const dbName = columns[1];
    const attended = columns[2];
    const email = columns[3] || ""; // preserve email if present

    if (dbTicketId === ticketData.ticketId && dbName === ticketData.name) {
      found = true;
      if (attended === 'false') {
        // Update row while preserving email if exists
        rows[i] = `${dbTicketId},${dbName},true,${email}`;
        resultDiv.innerHTML = "✅ Valid ticket! Attendee marked as attended.";
        resultDiv.className = "result valid";
        logMessage = "Ticket verified successfully.";
        console.log(`Ticket verified: Ticket ID ${dbTicketId} marked as attended.`);
      } else {
        resultDiv.innerHTML = "⚠️ Ticket already used!";
        resultDiv.className = "result used";
        logMessage = "Ticket already used.";
        console.log(`Ticket verification attempted: Ticket ID ${dbTicketId} already used.`);
      }
      break;
    }
  }

  if (!found) {
    resultDiv.innerHTML = "❌ Ticket not found in the database!";
    resultDiv.className = "result invalid";
    logMessage = "Ticket not found.";
    console.log("Ticket verification failed: No matching ticket found.");
  }

  ticketDatabase = rows.join('\n');
  updateLocalAttendance();
  updateTicketList();
  logAudit("verify", ticketData, logMessage);
}

/* ----- Manual Ticket Verification (unchanged) ----- */
function verifyTicketManual() {
  const ticketId = document.getElementById('manualTicketId').value.trim();
  const name = document.getElementById('manualAttendeeName').value.trim();
  console.log(`Manual verification initiated for Ticket ID: ${ticketId}, Name: ${name}`);
  const resultDiv = document.getElementById('manualVerificationResult');
  if (!ticketId || !name) {
    resultDiv.innerHTML = "Please fill in both fields for manual verification!";
    resultDiv.className = "result invalid";
    console.log("Manual verification aborted: Missing fields.");
    return;
  }
  const ticketData = { ticketId, name };
  verifyTicketData(ticketData, resultDiv);
}

/* ----- Toggle Manual Verification Display (unchanged) ----- */
function toggleManualVerification() {
  const container = document.getElementById('manual-verification-container');
  const toggleBtn = document.getElementById('toggleManualBtn');
  if (container.style.display === 'none' || container.style.display === '') {
    container.style.display = 'block';
    toggleBtn.innerText = 'Hide Manual Verification';
    console.log("Manual verification display shown.");
    logAudit("toggle-manual", {}, "Manual verification display shown.");
  } else {
    container.style.display = 'none';
    toggleBtn.innerText = 'Show Manual Verification';
    console.log("Manual verification display hidden.");
    logAudit("toggle-manual", {}, "Manual verification display hidden.");
  }
}

/* ----- Export CSV Database (unchanged) ----- */
function exportCSV() {
  console.log("Exporting CSV Database...");
  const blob = new Blob([ticketDatabase], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ticket_database.csv';
  link.click();
  console.log("CSV Database exported successfully.");
  logAudit("export-csv", {}, "CSV database exported successfully.");
}

/* ----- Export Audit Log (unchanged) ----- */
function exportAuditLog() {
  console.log("Exporting Audit Log...");
  let csv = "Timestamp,Action,Ticket ID,Name,Message\n";
  auditLog.forEach(entry => {
    csv += `${entry.timestamp},${entry.action},${entry.ticketData.ticketId || ""},${entry.ticketData.name || ""},${entry.message}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'audit_log.csv';
  link.click();
  console.log("Audit Log exported successfully.");
  logAudit("export-audit", {}, "Audit log exported successfully.");
}

/* ----- Reset Database (unchanged) ----- */
function resetDatabase() {
  if (confirm("Reload the static database? All unsaved changes will be lost.")) {
    console.log("Database reset initiated by user.");
    logAudit("reset-database", {}, "User initiated database reset.");
    loadDatabase();
  } else {
    console.log("Database reset canceled by user.");
    logAudit("reset-database", {}, "User canceled database reset.");
  }
}

/* ===================== NEW FUNCTIONS: Main Page Attendance Management ===================== */
function mainResetAttendance() {
  console.log("Main page reset attendance initiated.");
  logAudit("main-reset-init", {}, "User initiated main page attendance reset.");
  if (confirm("SERIOUS ALERT: This will reset all attendance data to the original CSV state. Proceed?")) {
    let pin = prompt("Enter ADMIN PIN to confirm reset:");
    if (pin && btoa(pin) === ADMIN_PIN_BASE64) {
      localStorage.removeItem("attendanceData");
      console.log("Main page attendance reset successful.");
      logAudit("main-reset-success", {}, "Attendance data reset successfully from main page.");
      loadDatabase();
      alert("Attendance has been reset.");
    } else {
      console.warn("Main page attendance reset failed: Incorrect PIN.");
      logAudit("main-reset-failed", {}, "Incorrect ADMIN PIN for main page attendance reset.");
      alert("Incorrect PIN. Attendance reset aborted.");
    }
  } else {
    console.log("Main page attendance reset canceled by user.");
    logAudit("main-reset-canceled", {}, "User canceled main page attendance reset.");
  }
}

function mainEditAttendance() {
  console.log("Main page edit attendance initiated.");
  logAudit("main-edit-init", {}, "User initiated main page attendance edit.");
  if (confirm("SERIOUS ALERT: This will allow you to edit attendance for a ticket. Proceed?")) {
    let pin = prompt("Enter ADMIN PIN to confirm editing:");
    if (pin && btoa(pin) === ADMIN_PIN_BASE64) {
      let ticketId = prompt("Enter Ticket ID to edit:");
      if (ticketId) {
        let newStatus = prompt("Enter new attendance status (true/false):");
        if (newStatus === "true" || newStatus === "false") {
          updateAttendanceForTicket(ticketId, newStatus === "true");
          alert("Attendance updated successfully.");
          console.log(`Main page attendance updated for Ticket ID ${ticketId} to ${newStatus}.`);
          logAudit("main-edit-success", { ticketId: ticketId }, `Attendance updated to ${newStatus} on main page.`);
        } else {
          alert("Invalid attendance status. Please enter true or false.");
          console.warn("Main page edit attendance failed: Invalid attendance status input.");
          logAudit("main-edit-failed", { ticketId: ticketId }, "Invalid attendance status entered on main page.");
        }
      } else {
        alert("Ticket ID is required.");
        console.warn("Main page edit attendance failed: No Ticket ID provided.");
        logAudit("main-edit-failed", {}, "No Ticket ID provided on main page edit.");
      }
    } else {
      console.warn("Main page edit attendance failed: Incorrect PIN.");
      logAudit("main-edit-failed", {}, "Incorrect ADMIN PIN for main page edit.");
      alert("Incorrect PIN. Edit attendance aborted.");
    }
  } else {
    console.log("Main page edit attendance canceled by user.");
    logAudit("main-edit-canceled", {}, "User canceled main page attendance edit.");
  }
}

/* ===================== NEW FUNCTIONS: Admin Page Attendance Management ===================== */
function adminResetAttendance() {
  console.log("Admin page reset attendance initiated.");
  logAudit("admin-reset-init", {}, "Admin initiated attendance reset.");
  if (confirm("SERIOUS ALERT: This will reset all attendance data to the original CSV state. Proceed?")) {
    localStorage.removeItem("attendanceData");
    console.log("Admin page attendance reset successful.");
    logAudit("admin-reset-success", {}, "Attendance data reset successfully from admin page.");
    loadAdminDashboard();  // Refresh the admin dashboard immediately after reset.
    alert("Attendance has been reset.");
  } else {
    console.log("Admin page attendance reset canceled by user.");
    logAudit("admin-reset-canceled", {}, "Admin canceled attendance reset.");
  }
}

function adminEditAttendance() {
  console.log("Admin page edit attendance initiated.");
  logAudit("admin-edit-init", {}, "Admin initiated attendance edit.");
  if (confirm("SERIOUS ALERT: This will allow you to edit attendance for a ticket. Proceed?")) {
    let ticketId = prompt("Enter Ticket ID to edit:");
    if (ticketId) {
      let newStatus = prompt("Enter new attendance status (true/false):");
      if (newStatus === "true" || newStatus === "false") {
        updateAttendanceForTicket(ticketId, newStatus === "true");
        alert("Attendance updated successfully.");
        console.log(`Admin page attendance updated for Ticket ID ${ticketId} to ${newStatus}.`);
        logAudit("admin-edit-success", { ticketId: ticketId }, `Attendance updated to ${newStatus} on admin page.`);
      } else {
        alert("Invalid attendance status. Please enter true or false.");
        console.warn("Admin page edit attendance failed: Invalid attendance status input.");
        logAudit("admin-edit-failed", { ticketId: ticketId }, "Invalid attendance status entered on admin page.");
      }
    } else {
      alert("Ticket ID is required.");
      console.warn("Admin page edit attendance failed: No Ticket ID provided.");
      logAudit("admin-edit-failed", {}, "No Ticket ID provided on admin page edit.");
    }
  } else {
    console.log("Admin page edit attendance canceled by user.");
    logAudit("admin-edit-canceled", {}, "Admin canceled attendance edit.");
  }
}

function updateAttendanceForTicket(ticketId, attendedStatus) {
  let rows = ticketDatabase.trim().split('\n');
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    let columns = rows[i].split(',');
    if (columns[0] === ticketId) {
      columns[2] = attendedStatus ? 'true' : 'false';
      rows[i] = columns.join(',');
      found = true;
      break;
    }
  }
  if (found) {
    ticketDatabase = rows.join('\n');
    updateLocalAttendance();
    updateTicketList();
    // Also update admin table if it exists
    if (document.getElementById('adminTicketList')) {
      renderAdminTable();
    }
    console.log(`Attendance for Ticket ID ${ticketId} updated to ${attendedStatus}.`);
    logAudit("update-attendance", { ticketId: ticketId }, `Attendance updated to ${attendedStatus}.`);
  } else {
    console.warn(`Ticket ID ${ticketId} not found for attendance update.`);
    logAudit("update-attendance-failed", { ticketId: ticketId }, "Ticket ID not found.");
  }
}

/* ===================== ADMIN PAGE ===================== */

/* ----- PIN Verification (updated to use Base64) ----- */
function checkAdminPIN() {
  const enteredPIN = document.getElementById('adminPin').value;
  console.log("Admin PIN entered:", enteredPIN);
  if (btoa(enteredPIN) === ADMIN_PIN_BASE64) {
    console.log("Admin PIN verification successful.");
    logAudit("admin-login", {}, "Admin PIN verified successfully.");
    document.getElementById('pin-section').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    loadAdminDashboard();
  } else {
    document.getElementById('pinError').innerText = "Incorrect PIN!";
    console.warn("Incorrect Admin PIN entered.");
    logAudit("admin-login-failed", {}, "Incorrect Admin PIN entered.");
  }
}

/* ----- Load Admin Dashboard (unchanged) ----- */
function loadAdminDashboard() {
  console.log("Loading Admin Dashboard...");
  fetch("tickets.csv")
    .then(response => response.text())
    .then(data => {
      let rows = data.trim().split('\n');
      const attendanceData = loadAttendanceFromLocalStorage();
      for (let i = 1; i < rows.length; i++) {
        let columns = rows[i].split(',');
        let ticketId = columns[0];
        if (attendanceData.hasOwnProperty(ticketId)) {
          columns[2] = attendanceData[ticketId] ? 'true' : 'false';
        }
        rows[i] = columns.join(',');
      }
      ticketDatabase = rows.join('\n');
      console.log("Admin Dashboard loaded: tickets.csv data retrieved and attendance merged.");
      logAudit("admin-load", {}, "Admin Dashboard loaded; CSV retrieved and attendance merged successfully.");
      renderAdminTable();
    })
    .catch(error => {
      console.error("Error loading tickets.csv for Admin Dashboard:", error);
      ticketDatabase = "Ticket ID,Name,Attended,Email\n";
      logAudit("admin-load-error", {}, "Error loading CSV for Admin Dashboard: " + error);
      renderAdminTable();
    });
}

/* ----- Open Google Form ----- */
function openGoogleForm() {
  console.log("Opening Googkle Form...");
  logAudit("open-google-form", {}, "Opening Google Form.");
  window.open("https://docs.google.com/spreadsheets/d/1HhjLiQ9MtxaB5dDFzstyGboadOsu6HyL38CNCJUMx84/edit?usp=sharing", "_blank");
}

/* ----- Render Admin Table (updated to include Email) ----- */
function renderAdminTable() {
  const rows = ticketDatabase.trim().split('\n');
  let tableHTML = "<table><thead><tr><th>Ticket ID</th><th>Name</th><th>Attended</th><th>Email</th></tr></thead><tbody>";

  for (let i = 1; i < rows.length; i++) {
    const columns = rows[i].split(',');
    const ticketId = columns[0];
    const name = columns[1];
    const attended = columns[2];
    const email = columns[3] ? columns[3] : "";
    tableHTML += `<tr>
      <td>${ticketId}</td>
      <td>${name}</td>
      <td>${attended === 'true' ? 'Yes' : 'No'}</td>
      <td>${email}</td>
    </tr>`;
  }

  tableHTML += "</tbody></table>";
  document.getElementById('adminTicketList').innerHTML = tableHTML;
  console.log("Admin ticket table rendered.");
  logAudit("render-admin-table", {}, "Admin ticket table rendered.");
}

/* ----- Admin Search Functionality (updated to include Email) ----- */
function searchTickets() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  console.log("Admin search initiated with query:", query);
  const rows = ticketDatabase.trim().split('\n');
  let tableHTML = "<table><thead><tr><th>Ticket ID</th><th>Name</th><th>Attended</th><th>Email</th></tr></thead><tbody>";
  let matches = 0;
  for (let i = 1; i < rows.length; i++) {
    const columns = rows[i].split(',');
    const ticketId = columns[0];
    const name = columns[1];
    const attended = columns[2];
    const email = columns[3] ? columns[3] : "";
    if (
      ticketId.toLowerCase().includes(query) ||
      name.toLowerCase().includes(query) ||
      email.toLowerCase().includes(query)
    ) {
      tableHTML += `<tr>
        <td>${ticketId}</td>
        <td>${name}</td>
        <td>${attended === 'true' ? 'Yes' : 'No'}</td>
        <td>${email}</td>
      </tr>`;
      matches++;
    }
  }
  tableHTML += "</tbody></table>";
  document.getElementById('adminTicketList').innerHTML = tableHTML;
  console.log(`Admin search completed. ${matches} matching tickets found.`);
  logAudit("search", { query }, `Admin search completed. Found ${matches} matching tickets.`);
}

/* ----- Admin QR Code Scanner with Raw Data (unchanged) ----- */
function startAdminScanner() {
  console.log("Starting Admin QR Code Scanner...");
  document.getElementById('decodedQRData').innerText = "";

  if (html5QrcodeAdminScanner) {
    html5QrcodeAdminScanner.clear();
  }

  html5QrcodeAdminScanner = new Html5QrcodeScanner(
    "admin-qr-reader", { fps: 60, qrbox: 250 }
  );
  html5QrcodeAdminScanner.render(onAdminScanSuccess, onAdminScanError);
}

function onAdminScanSuccess(decodedText) {
  console.log("Admin scan successful. Decoded text:", decodedText);
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
    console.log("Admin scan: QR data parsed successfully.");
  } catch (e) {
    decodedData += "<strong>Extracted Data:</strong><br>Could not parse JSON.";
    console.error("Admin scan: Error parsing QR data.", e);
  }

  document.getElementById('decodedQRData').innerHTML = decodedData;
  logAudit("admin-scan", { ticketId: decodedText, name: "" }, "Scanned in Admin");
}

function onAdminScanError(errorMessage) {
  console.warn("Admin Scan Error:", errorMessage);
}

/* ===================== NAVIGATION ===================== */

/* ----- Navigation Between Pages (unchanged) ----- */
function goToAdmin() {
  console.log("Navigating to Admin Panel...");
  logAudit("navigation", {}, "Navigated to Admin Panel.");
  window.location.href = "admin.html";
}

function goToMain() {
  console.log("Navigating back to Main Page...");
  logAudit("navigation", {}, "Navigated back to Main Page.");
  window.location.href = "index.html";
}

/* ----- Initialize on Page Load (unchanged) ----- */
document.addEventListener('DOMContentLoaded', () => {
  console.log("Document loaded. Initializing application...");
  loadDatabase();

  // For main page QR generator fields: trigger generateQR on Enter key
  const ticketIdInput = document.getElementById('ticketId');
  const attendeeNameInput = document.getElementById('attendeeName');
  if (ticketIdInput && attendeeNameInput) {
    ticketIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        generateQR();
      }
    });
    attendeeNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        generateQR();
      }
    });
  }

  // For manual verification fields: trigger verifyTicketManual on Enter key
  const manualTicketId = document.getElementById('manualTicketId');
  const manualAttendeeName = document.getElementById('manualAttendeeName');
  if (manualTicketId && manualAttendeeName) {
    manualTicketId.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyTicketManual();
      }
    });
    manualAttendeeName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyTicketManual();
      }
    });
  }

  // For admin PIN field: trigger checkAdminPIN on Enter key
  const adminPinInput = document.getElementById('adminPin');
  if (adminPinInput) {
    adminPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkAdminPIN();
      }
    });
  }

  // For admin search field: trigger searchTickets on Enter key
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchTickets();
      }
    });
  }
});
