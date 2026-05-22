var DATA_SHEET = "Data";
var LOG_SHEET  = "Log";

// ── Row index per section ─────────────────────────────────────────────────────
var ROWS = { expenses: 1, memory: 2, shopping: 3, blackboard: 4 };

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s  = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  return s;
}

// ── Migration: old single-blob A1 → per-row structure ────────────────────────
function migrate() {
  var sheet = getSheet(DATA_SHEET);
  // Check if already migrated: A1 should be "expenses" (a key string), not a JSON array/object
  var a1 = sheet.getRange("A1").getValue();
  if (a1 === "expenses") return; // already migrated

  // Read old blob
  var old = {};
  try { old = a1 ? JSON.parse(a1) : {}; } catch(e) { old = {}; }

  // Write per-row
  writeSection("expenses",  old.expenses   || []);
  writeSection("memory",    old.memory     || {});
  writeSection("shopping",  old.shopping   || []);
  writeSection("blackboard",old.blackboard || []);

  Logger.log("Migration complete.");
}

function writeSection(key, value) {
  var sheet = getSheet(DATA_SHEET);
  var row   = ROWS[key];
  sheet.getRange(row, 1).setValue(key);
  sheet.getRange(row, 2).setValue(JSON.stringify(value));
}

function readSection(key) {
  var sheet = getSheet(DATA_SHEET);
  var row   = ROWS[key];
  var val   = sheet.getRange(row, 2).getValue();
  if (!val) return key === "memory" ? {} : [];
  try { return JSON.parse(val); } catch(e) { return key === "memory" ? {} : []; }
}

function readAll() {
  migrate(); // no-op if already migrated
  return {
    expenses:   readSection("expenses"),
    memory:     readSection("memory"),
    shopping:   readSection("shopping"),
    blackboard: readSection("blackboard")
  };
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var section = e.parameter && e.parameter.section;
    var data;
    if (section && ROWS[section]) {
      migrate();
      var val = readSection(section);
      data = {}; data[section] = val;
    } else {
      data = readAll();
    }
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

    if (body.action === "write") {
      migrate(); // no-op if already done
      // Targeted section write
      if (body.section && ROWS[body.section] && body.data !== undefined) {
        writeSection(body.section, body.data);
        if (body.section === "expenses") writeLog(body.data);
        return ContentService
          .createTextOutput(JSON.stringify({ ok: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      // Legacy full write (fallback, shouldn't be used anymore)
      if (body.data) {
        if (body.data.expenses   !== undefined) writeSection("expenses",   body.data.expenses);
        if (body.data.memory     !== undefined) writeSection("memory",     body.data.memory);
        if (body.data.shopping   !== undefined) writeSection("shopping",   body.data.shopping);
        if (body.data.blackboard !== undefined) writeSection("blackboard", body.data.blackboard);
        writeLog(body.data.expenses || []);
        return ContentService
          .createTextOutput(JSON.stringify({ ok: true }))
          .setMimeType(ContentService.MimeType.JSON);
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

// ── Human-readable log sheet ──────────────────────────────────────────────────
function writeLog(expenses) {
  var sheet = getSheet(LOG_SHEET);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 5).setValues([["Date","Person","Amount","Category","Description"]]);
  if (!expenses.length) return;
  var sorted = expenses.slice().sort(function(a,b){
    return b.date < a.date ? -1 : b.date > a.date ? 1 : 0;
  });
  var rows = sorted.map(function(e){
    return [e.date, e.person, e.amount, e.category, e.description];
  });
  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
}
