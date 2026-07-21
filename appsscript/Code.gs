/**
 * Phonics Parrot — Google Apps Script Web App  v2.5
 * ============================================================
 * Scoped strictly to My Drive Root of the script/sheet owner.
 * Ensures uploaded audio files are owned by the Apps Script owner,
 * and patches Google Drive links cleanly into Google Sheets.
 *
 * Deploy as Web App:
 *   Extensions → Apps Script → Deploy → New deployment
 *   Execute as: Me  |  Who has access: Anyone
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────

var SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit";
var RECORDINGS_FOLDER_NAME = "Phonics Parrot Recordings";

// ── COLUMN MAP (1-indexed) ────────────────────────────────────────────────────

var COL = {
  TIMESTAMP : 1,
  STUDENT   : 2,
  ACTIVITY  : 3,
  TARGET    : 4,
  PHONEME   : 5,
  SPOKEN    : 6,
  SCORE     : 7,
  VERDICT   : 8,
  RECORDING : 9
};
var TOTAL_COLS = 9;

// ── SPREADSHEET RESOLVER ──────────────────────────────────────────────────────

function getSpreadsheet(data) {
  if (data && data.spreadsheetUrl) {
    try { return SpreadsheetApp.openByUrl(data.spreadsheetUrl); } catch (_) {}
  }
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (_) {}
  if (SPREADSHEET_URL && SPREADSHEET_URL.indexOf("YOUR_SPREADSHEET_ID_HERE") === -1) {
    try { return SpreadsheetApp.openByUrl(SPREADSHEET_URL); } catch (_) {}
  }
  throw new Error("Spreadsheet not configured. Open script inside Google Sheet or set SPREADSHEET_URL in Code.gs");
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", app: "Phonics Parrot v2.5" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return respond({ result: "error", message: "No POST body received." });
  }

  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
  } catch (_) {
    return respond({ result: "error", message: "System busy, please try again." });
  }

  try {
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (_) {
      return respond({ result: "error", message: "Invalid JSON payload." });
    }

    if (data.audioData) {
      if (!/^[A-Za-z0-9+/=]+$/.test(data.audioData)) {
        return respond({ result: "error", message: "Invalid or missing audioData format." });
      }
      if (data.audioData.length > 30 * 1024 * 1024) {
        return respond({ result: "error", message: "Audio file too large." });
      }
    }

    var hasPerfData = ("spoken" in data) || ("score" in data) || ("target" in data);

    // Atomic combined request: audioData + log performance info
    if (data.audioData && hasPerfData) {
      var driveUrl = saveAudioToDrive(data);
      data.driveUrl = driveUrl;
      logToSheet(data);
      SpreadsheetApp.flush();
      return respond({ result: "success", driveUrl: driveUrl, status: "logged_and_linked" });
    }

    // Audio-only upload request
    if (data.audioData) {
      var driveUrl = saveAudioToDrive(data);
      var cacheKey = getCacheKey(data);
      
      try { CacheService.getScriptCache().put(cacheKey, driveUrl, 21600); } catch (_) {}
      try { PropertiesService.getScriptProperties().setProperty(cacheKey, driveUrl); } catch (_) {}

      var patchStatus = patchLastRowDriveUrl(data.class, data.student, driveUrl, data);
      SpreadsheetApp.flush();
      return respond({ result: "success", driveUrl: driveUrl, patchStatus: patchStatus });
    }

    // Performance log request
    logToSheet(data);
    SpreadsheetApp.flush();
    return respond({ result: "success" });

  } catch (err) {
    return respond({ result: "error", message: err.toString() });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (_) {} }
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getCacheKey(data) {
  if (data.sessionId) return "pp_req_" + data.sessionId;
  var c = (data.class || data.teacher || "guest").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  var s = (data.student || "guest").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  var t = (data.timestamp || "").replace(/[^0-9]/g, "");
  return "pp_rec_" + c + "_" + s + (t ? "_" + t : "");
}

// ── GOOGLE DRIVE UPLOAD ───────────────────────────────────────────────────────

function saveAudioToDrive(data) {
  var audioBytes  = Utilities.base64Decode(data.audioData);
  var filename    = data.filename || ((data.student || "guest") + "_recording.webm");
  var blob        = Utilities.newBlob(audioBytes, "audio/webm", filename);

  // Scope strictly to My Drive Root of the script/sheet owner
  var myDrive     = DriveApp.getRootFolder();
  var props       = PropertiesService.getScriptProperties();
  var folderId    = props.getProperty("PP_RECORDINGS_FOLDER_ID");
  var rootFolder;
  if (folderId) {
    try { rootFolder = DriveApp.getFolderById(folderId); } catch (_) {}
  }
  if (!rootFolder) {
    var rootFolders = myDrive.getFoldersByName(RECORDINGS_FOLDER_NAME);
    rootFolder = rootFolders.hasNext() ? rootFolders.next() : myDrive.createFolder(RECORDINGS_FOLDER_NAME);
    props.setProperty("PP_RECORDINGS_FOLDER_ID", rootFolder.getId());
  }

  var className   = (data.class    || "Guest").trim().replace(/[\/\\:*?"<>|]/g, "_");
  var studentName = (data.student  || "Guest").trim().replace(/[\/\\:*?"<>|]/g, "_");
  var activity    = (data.activity || "activity").trim().replace(/[\/\\:*?"<>|]/g, "_");

  var classFolder   = getOrCreateSubfolder(rootFolder, className);
  var studentFolder = getOrCreateSubfolder(classFolder, studentName);
  var actFolder     = getOrCreateSubfolder(studentFolder, activity);

  var file = actFolder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("Sharing permission warning: " + e.toString());
    // Continue executing and return the URL even if sharing fails
  }

  return file.getUrl();
}

function getOrCreateSubfolder(parent, name) {
  var iter = parent.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

// ── PATCH DRIVE URL INTO EXISTING ROW (MULTI-TAB RESILIENT) ───────────────────

function patchLastRowDriveUrl(className, studentName, driveUrl, data) {
  if (!driveUrl) return "No driveUrl provided";
  try {
    var ss = getSpreadsheet(data);
    var targetStudent = (studentName || "").trim().toLowerCase();

    // 1. Try specified class tab first
    if (className) {
      var safeName = className.trim().replace(/[\\\/\?\*\[\]:]/g, "_").substring(0, 100);
      var sheet = ss.getSheetByName(safeName);
      if (sheet && patchSheetRow(sheet, targetStudent, driveUrl)) {
        return "Patched in class tab: " + className;
      }
    }

    // 2. Fallback: Search all sheets in workbook
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      if (patchSheetRow(sheets[s], targetStudent, driveUrl)) {
        return "Patched in tab: " + sheets[s].getName();
      }
    }

    return "No unlinked row found across any tab";
  } catch (err) {
    return "Error: " + err.toString();
  }
}

function patchSheetRow(sheet, targetStudent, driveUrl) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 2) return false;

  var scanStart = Math.max(3, lastRow - 50);
  var numRows   = lastRow - scanStart + 1;
  var values    = sheet.getRange(scanStart, 1, numRows, TOTAL_COLS).getValues();

  for (var i = values.length - 1; i >= 0; i--) {
    var rowStudent = String(values[i][COL.STUDENT - 1] || "").trim().toLowerCase();
    var rowRecLink = String(values[i][COL.RECORDING - 1] || "").trim();

    var isMatch = (rowStudent === targetStudent) || (!targetStudent || targetStudent === "guest");

    if (isMatch && !rowRecLink) {
      var targetRow = scanStart + i;
      var cell = sheet.getRange(targetRow, COL.RECORDING);
      writeRecordingCell(cell, driveUrl);
      return true;
    }
  }
  return false;
}

function writeRecordingCell(cell, driveUrl) {
  try {
    cell.setRichTextValue(
      SpreadsheetApp.newRichTextValue()
        .setText("🎙 Listen")
        .setLinkUrl(driveUrl)
        .build()
    );
  } catch (e) {
    cell.setValue(driveUrl);
  }
  cell.setFontColor("#1155CC").setFontWeight("bold").setHorizontalAlignment("center");
}

// ── GOOGLE SHEETS LOGGING ─────────────────────────────────────────────────────

function logToSheet(data) {
  var ss      = getSpreadsheet(data);
  var tabName = (data.class || data.teacher || "Guest")
    .trim()
    .replace(/[\\\/\?\*\[\]:]/g, "_")
    .substring(0, 100);

  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    setupClassSheet(sheet, tabName);
  }

  var score   = (data.score !== undefined && data.score !== "") ? Number(data.score) : "";
  var verdict = data.verdict || getVerdict(score);

  var cacheKey = getCacheKey(data);
  var driveUrl = data.driveUrl || "";

  if (!driveUrl) {
    try { driveUrl = CacheService.getScriptCache().get(cacheKey) || ""; } catch (_) {}
  }
  if (!driveUrl) {
    try {
      var props = PropertiesService.getScriptProperties();
      driveUrl = props.getProperty(cacheKey) || "";
    } catch (_) {}
  }

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.student   || "Guest",
    formatActivity(data.activity),
    data.target    || "",
    data.phoneme   || "",
    data.spoken    || "",
    score,
    verdict,
    ""
  ]);

  var newRow = sheet.getLastRow();

  if (driveUrl) {
    var recCell = sheet.getRange(newRow, COL.RECORDING);
    writeRecordingCell(recCell, driveUrl);
  }

  if (score !== "") {
    colorScoreCell(sheet.getRange(newRow, COL.SCORE), score);
  }

  if (verdict) {
    colorVerdictCell(sheet.getRange(newRow, COL.VERDICT), score);
  }

  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, TOTAL_COLS).setBackground("#F3F6FF");
  }

  sheet.getRange(newRow, COL.SPOKEN).setWrap(true);
}

function formatActivity(activity) {
  var map = {
    "builder"  : "🔡 Flashcard Builder",
    "reader"   : "📖 Line Reader",
    "speak"    : "🗣️ Poem Builder",
    "pingpong" : "🏓 Phonics Pong"
  };
  return map[activity] || (activity || "");
}

function getVerdict(score) {
  if (score === "" || score === undefined || score === null) return "";
  if (score >= 80) return "🌟 Excellent";
  if (score >= 50) return "👍 Good";
  return "💪 Keep Trying";
}

function colorScoreCell(cell, score) {
  if (score >= 80) {
    cell.setBackground("#C9EAC9").setFontColor("#1B5E20").setFontWeight("bold");
  } else if (score >= 50) {
    cell.setBackground("#FFF9C4").setFontColor("#6D4C00").setFontWeight("bold");
  } else {
    cell.setBackground("#FFCDD2").setFontColor("#B71C1C").setFontWeight("bold");
  }
  cell.setHorizontalAlignment("center");
}

function colorVerdictCell(cell, score) {
  if (score >= 80) {
    cell.setBackground("#E8F5E9").setFontColor("#2E7D32");
  } else if (score >= 50) {
    cell.setBackground("#FFFDE7").setFontColor("#F57F17");
  } else {
    cell.setBackground("#FFEBEE").setFontColor("#C62828");
  }
}

// ── CLASS SHEET SETUP ─────────────────────────────────────────────────────────

function setupClassSheet(sheet, className) {
  sheet.insertRowBefore(1);
  var titleRange = sheet.getRange(1, 1, 1, TOTAL_COLS);
  titleRange.merge();
  titleRange
    .setValue("📚  Class: " + className + "   —   Phonics Parrot Performance Log")
    .setBackground("#1A237E")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(14)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 44);

  var headers = [
    "Timestamp", "Student", "Activity",
    "Target Phrase", "Phoneme",
    "Spoken", "Score (%)", "Verdict", "Recording"
  ];
  sheet.appendRow(headers);

  var headerRange = sheet.getRange(2, 1, 1, TOTAL_COLS);
  headerRange
    .setBackground("#283593")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(2, 32);

  sheet.setColumnWidth(COL.TIMESTAMP , 175);
  sheet.setColumnWidth(COL.STUDENT   , 130);
  sheet.setColumnWidth(COL.ACTIVITY  , 160);
  sheet.setColumnWidth(COL.TARGET    , 210);
  sheet.setColumnWidth(COL.PHONEME   ,  90);
  sheet.setColumnWidth(COL.SPOKEN    , 210);
  sheet.setColumnWidth(COL.SCORE     ,  80);
  sheet.setColumnWidth(COL.VERDICT   , 135);
  sheet.setColumnWidth(COL.RECORDING , 110);

  sheet.setFrozenRows(2);

  var palette = [
    "#E53935","#8E24AA","#1E88E5","#00897B",
    "#43A047","#F4511E","#6D4C41","#546E7A",
    "#3949AB","#00ACC1"
  ];
  var hash = 0;
  for (var i = 0; i < className.length; i++) hash = (hash * 31 + className.charCodeAt(i)) & 0xFFFF;
  sheet.setTabColor(palette[hash % palette.length]);
}
