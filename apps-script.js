// Shared Ledger — Google Apps Script backend
// Paste this entire file into your Apps Script editor, then deploy as a Web App.
// Execute as: Me | Who has access: Anyone

var SHEET_NAME = "Data";

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange("A1").setValue(JSON.stringify({ expenses: [], memory: {} }));
  }
  return sheet;
}

function doGet(e) {
  try {
    var sheet = getSheet();
    var val = sheet.getRange("A1").getValue();
    var data = val ? JSON.parse(val) : { expenses: [], memory: {} };
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "write" && body.data) {
      var sheet = getSheet();
      sheet.getRange("A1").setValue(JSON.stringify(body.data));
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
