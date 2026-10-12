/**
 * Prescera Labs · request-access form handler (Google Apps Script web app).
 *
 * Bound to the Google Sheet that collects requests. On each POST from the website it:
 *   1. checks the spam trap and required fields,
 *   2. appends one row to the "Requests" tab (created with headers on first use),
 *   3. emails the team, with Reply-To set to the person who asked.
 *
 * Setup: see apps-script/README.md.
 */

/* ----- settings ----- */
const SHEET_NAME = "Requests";
const NOTIFY_TO = "vamsi@presceralabs.ai";           // comma-separate several addresses if needed
const SUBJECT_PREFIX = "Access request: ";
const SEND_CONFIRMATION = false;                      // true = also send the requester a short receipt
const MAX_LEN = { name: 200, email: 200, org: 200, role: 100, need: 3000, page: 500 };
const ROLES = ["Security leader", "Security practitioner", "Risk or compliance", "Investor", "Security researcher", "Press", "Other"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // spam trap: the hidden "website" field is only ever filled by bots. Report success and do nothing.
    if (data.website) return json_({ ok: true });

    const row = {
      name: clip_(data.name, MAX_LEN.name),
      email: clip_(data.email, MAX_LEN.email),
      org: clip_(data.org, MAX_LEN.org),
      role: clip_(data.role, MAX_LEN.role),
      need: clip_(data.need, MAX_LEN.need),
      page: clip_(data.page, MAX_LEN.page),
    };
    for (const k of ["name", "email", "org", "role"]) if (!row[k]) return json_({ ok: false, error: "Missing " + k });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return json_({ ok: false, error: "Invalid email" });
    if (ROLES.indexOf(row.role) === -1) row.role = "Other";

    lock.waitLock(10000);
    const sheet = sheet_();
    sheet.appendRow([new Date(), safe_(row.name), safe_(row.email), safe_(row.org), safe_(row.role), safe_(row.need), safe_(row.page)]);
    lock.releaseLock();

    MailApp.sendEmail({
      to: NOTIFY_TO,
      replyTo: row.email,
      name: "Prescera Labs website",
      subject: SUBJECT_PREFIX + row.org,
      body:
        "Name: " + row.name + "\n" +
        "Work email: " + row.email + "\n" +
        "Organisation: " + row.org + "\n" +
        "Role: " + row.role + "\n\n" +
        "What they would need to see first:\n" + (row.need || "(not given)") + "\n\n" +
        "Sent from: " + row.page + "\n" +
        "Sheet: " + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    });

    if (SEND_CONFIRMATION) {
      MailApp.sendEmail({
        to: row.email,
        replyTo: NOTIFY_TO.split(",")[0].trim(),
        name: "Prescera Labs",
        subject: "We have your request",
        body: "Hello " + row.name + ",\n\nThank you for asking about Prescera Labs. We have your request and will reply by email.\n\nPrescera Labs",
      });
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "Server error" });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* A GET in the browser confirms the deployment is live. */
function doGet() {
  return json_({ ok: true, service: "prescera-request-access" });
}

/* Run this once from the editor to grant permissions and check the email arrives. */
function testSubmit() {
  const res = doPost({ postData: { contents: JSON.stringify({ name: "Test", email: "test@example.com", org: "Test org", role: "Other", need: "Ignore: setup test", page: "apps-script test" }) } });
  console.log(res.getContent());
}

/* ----- helpers ----- */
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Received", "Name", "Work email", "Organisation", "Role", "What they need to see first", "Page"]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 7).setFontWeight("bold");
  }
  return sh;
}
function clip_(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }
/* stop spreadsheet formula injection: a cell that starts with = + - @ is stored as text */
function safe_(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
