// ── PS Central — Apps Script backend ─────────────────────────────────────────
// Roles:
//   1. "notify" — forward FCM push notification to a device token
//   2. "log"    — write human-readable audit log to Google Sheets
//   3. Legacy read/write — kept for the one-time data migration page
//
// FCM Server Key must be stored in Script Properties:
//   Project Settings → Script Properties → Add: FCM_SERVER_KEY = <your key>
//   Get it from: Firebase Console → Project Settings → Cloud Messaging → Server key
// ─────────────────────────────────────────────────────────────────────────────

var DATA_SHEET = "Data";
var LOG_SHEET  = "Log";
var ROWS = { expenses: 1, memory: 2, shopping: 3, blackboard: 4 };

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s  = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  return s;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var data = readAll();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // ── FCM push notification ────────────────────────────────────────────────
    if (body.action === "notify") {
      if (body.token && body.title) {
        sendFCM(body.token, body.title, body.body || "");
      }
      return ok();
    }

    // ── Sheets audit log ─────────────────────────────────────────────────────
    if (body.action === "log") {
      if (Array.isArray(body.expenses)) writeLog(body.expenses);
      return ok();
    }

    // ── Legacy write (used by migrate.html) ──────────────────────────────────
    if (body.action === "write") {
      if (body.section && ROWS[body.section] && body.data !== undefined) {
        writeSection(body.section, body.data);
        if (body.section === "expenses") writeLog(body.data);
        return ok();
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function ok() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── FCM HTTP v1 API ───────────────────────────────────────────────────────────
// Requires two Script Properties:
//   FCM_SERVICE_ACCOUNT — full JSON content of the Firebase service account key
//   FCM_PROJECT_ID      — your Firebase project ID (e.g. psledger-a72d0)
function sendFCM(token, title, body) {
  var props = PropertiesService.getScriptProperties();
  var projectId = props.getProperty("FCM_PROJECT_ID");
  var saJson    = props.getProperty("FCM_SERVICE_ACCOUNT");
  if (!projectId || !saJson) { Logger.log("FCM props not set"); return; }

  var sa = JSON.parse(saJson);
  var accessToken = getServiceAccountToken(sa);
  if (!accessToken) { Logger.log("Could not get access token"); return; }

  var message = {
    message: {
      token: token,
      notification: { title: title, body: body },
      webpush: {
        notification: { icon: "apple-touch-icon.png" },
        fcm_options: { link: "https://shailevy-stack.github.io/PSLedger/" }
      }
    }
  };

  var response = UrlFetchApp.fetch(
    "https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send",
    {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
      },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    }
  );

  Logger.log("FCM v1 response: " + response.getContentText());
}

function getServiceAccountToken(sa) {
  var now = Math.floor(Date.now() / 1000);
  var header  = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  var claim   = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  }));
  var input     = header + "." + claim;
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(input, sa.private_key)
  );
  var jwt = input + "." + signature;

  var response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  var result = JSON.parse(response.getContentText());
  return result.access_token || null;
}

// ── Sheets helpers ────────────────────────────────────────────────────────────
function writeSection(key, value) {
  var sheet = getSheet(DATA_SHEET);
  sheet.getRange(ROWS[key], 1).setValue(key);
  sheet.getRange(ROWS[key], 2).setValue(JSON.stringify(value));
}

function readSection(key) {
  var sheet = getSheet(DATA_SHEET);
  var val = sheet.getRange(ROWS[key], 2).getValue();
  if (!val) return key === "memory" ? {} : [];
  try { return JSON.parse(val); } catch(e) { return key === "memory" ? {} : []; }
}

function readAll() {
  return {
    expenses:   readSection("expenses"),
    memory:     readSection("memory"),
    shopping:   readSection("shopping"),
    blackboard: readSection("blackboard")
  };
}

function writeLog(expenses) {
  var sheet = getSheet(LOG_SHEET);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 5).setValues([["Date","Person","Amount","Category","Description"]]);
  if (!expenses || !expenses.length) return;
  var sorted = expenses.slice().sort(function(a,b){
    return b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
  });
  var rows = sorted.map(function(e){
    return [e.date, e.person, e.amount, e.category, e.description];
  });
  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
}
