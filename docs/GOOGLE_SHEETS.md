# Google Sheets Integration Guide

To track student performance dynamically without waiting for activities to end, follow these steps to deploy and configure a Google Sheets App Script:

## Step 1: Prepare the Google Sheet
1. Create a new Google Sheet.
2. The App Script will automatically create three tabs when the first student attempts an activity:
   - **Overview**: Shows each student, their overall accuracy average, total attempts, and last active timestamp.
   - **All Logs**: A master log of every attempt.
   - **Individual Student Tabs** (e.g. `John`, `Sarah`): Dynamically created sheets dedicated to each student's progress.

## Step 2: Add the Apps Script Code
1. In your Google Sheet, click **Extensions** → **Apps Script**.
2. Delete any default code in the editor (usually `function myFunction() {}`).
3. Copy and paste the following script into the `code.gs` file:

```javascript
/**
 * Phonics Parrot Google Sheets Log Handler v2.0
 * 
 * Automatically logs student attempts, creates individual tabs per student,
 * and maintains an index Overview sheet.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var timestamp = data.timestamp || new Date().toISOString();
    var student = (data.student || "Guest").trim();
    var className = (data.class || "Guest").trim();
    var teacher = (data.teacher || "Guest").trim();
    var activity = data.activity || "Unknown";
    var target = data.target || "";
    var phoneme = data.phoneme || "";
    var spoken = data.spoken || "";
    var score = data.score !== undefined ? data.score : "";
    var verdict = data.verdict || "";
    
    // Map activity keys to readable names
    var activityMap = {
      "builder": "Flashcard Builder",
      "reader": "Line Reader",
      "speak": "Poem Builder",
      "pingpong": "Phonics Pong"
    };
    var activityName = activityMap[activity] || activity;
    
    // 1. Log to the Student's Individual Tab
    var sheetName = student;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "Timestamp",
        "Class",
        "Activity",
        "Target Word/Phrase",
        "Phoneme",
        "Spoken Word",
        "Accuracy Score",
        "Verdict",
        "Teacher"
      ]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e0f2f1");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      timestamp,
      className,
      activityName,
      target,
      phoneme,
      spoken,
      score,
      verdict,
      teacher
    ]);
    
    // 2. Log to a Master Log Tab (All Logs)
    var masterSheet = ss.getSheetByName("All Logs");
    if (!masterSheet) {
      masterSheet = ss.insertSheet("All Logs");
      masterSheet.appendRow([
        "Timestamp",
        "Class",
        "Student",
        "Activity",
        "Target Word/Phrase",
        "Phoneme",
        "Spoken Word",
        "Accuracy Score",
        "Verdict",
        "Teacher"
      ]);
      masterSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#ffe0b2");
      masterSheet.setFrozenRows(1);
    }
    masterSheet.appendRow([
      timestamp,
      className,
      student,
      activityName,
      target,
      phoneme,
      spoken,
      score,
      verdict,
      teacher
    ]);
    
    // 3. Update the Overview / Index Tab
    var overview = ss.getSheetByName("Overview");
    if (!overview) {
      overview = ss.insertSheet("Overview", 0);
      overview.appendRow([
        "Student Name",
        "Class",
        "Overall Accuracy",
        "Total Attempts",
        "Last Active"
      ]);
      overview.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#b2dfdb");
      overview.setFrozenRows(1);
    }
    
    // Find the student's row in Overview
    var lastRow = overview.getLastRow();
    var studentRow = -1;
    if (lastRow > 1) {
      var range = overview.getRange(2, 1, lastRow - 1, 1);
      var values = range.getValues();
      for (var i = 0; i < values.length; i++) {
        if (values[i][0].toString().toLowerCase() === student.toLowerCase()) {
          studentRow = i + 2; // 1-indexed plus header offset
          break;
        }
      }
    }
    
    // Calculate new stats for student from their sheet
    var studentData = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1).getValues(); // Column G is Accuracy Score (7th column)
    var totalAttempts = studentData.length;
    var sumScores = 0;
    var countScores = 0;
    for (var j = 0; j < studentData.length; j++) {
      var val = parseFloat(studentData[j][0]);
      if (!isNaN(val)) {
        sumScores += val;
        countScores++;
      }
    }
    var avgAccuracy = countScores > 0 ? Math.round((sumScores / countScores)) + "%" : "N/A";
    
    if (studentRow !== -1) {
      overview.getRange(studentRow, 2).setValue(className);
      overview.getRange(studentRow, 3).setValue(avgAccuracy);
      overview.getRange(studentRow, 4).setValue(totalAttempts);
      overview.getRange(studentRow, 5).setValue(timestamp);
    } else {
      overview.appendRow([
        student,
        className,
        avgAccuracy,
        totalAttempts,
        timestamp
      ]);
    }
    
    // Auto-resize columns to fit content
    sheet.autoResizeColumns(1, 9);
    masterSheet.autoResizeColumns(1, 10);
    overview.autoResizeColumns(1, 5);
    
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Step 3: Deploy as a Web App
1. In the Apps Script editor, click **Deploy** (top-right corner) → **New deployment**.
2. Click the gear icon next to "Select type" → Choose **Web app**.
3. Configure the deployment:
   - **Description**: `Phonics Parrot Log API`
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone** (This is crucial, otherwise student browser requests will be blocked as unauthorized)
4. Click **Deploy**.
5. Copy the generated **Web app URL**.
6. Paste the URL into the Google Sheets Web App URL field in the **Teacher Dashboard** (`teacher.html`) in Phonics Parrot.
