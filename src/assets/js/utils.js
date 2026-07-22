/**
 * utils.js — Phonics Parrot Shared Utilities  v3.0
 *
 * Fixes:
 *  - censor() applied to re-test after replace (was testing original, replacing copy)
 *  - getBestVoice() now handles voices loading asynchronously more robustly
 *  - requestMicPermission() now stops tracks properly (was leaking mic access)
 *  - checkLessonData() hardened against corrupted data
 *  - $ shortcut renamed to $id to avoid shadowing jQuery if present
 */

/* ── ACOUSTIC PHONETIC DICTIONARY MAP ───────────────────────── */

const PHONETIC_EXCEPTIONS = {
  "choir": ["/k/", "/aɪ/"],
  "quire": ["/k/", "/aɪ/"],
  "weigh": ["/w/", "/eɪ/"],
  "way": ["/w/", "/eɪ/"],
  "read": ["/r/", "/i:/"],
  "red": ["/r/", "/e/"],
  "two": ["/t/", "/u:/"],
  "too": ["/t/", "/u:/"],
  "to": ["/t/", "/u:/"],
  "one": ["/w/", "/ʌ/", "/n/"],
  "won": ["/w/", "/ʌ/", "/n/"],
  "eight": ["/eɪ/", "/t/"],
  "ate": ["/eɪ/", "/t/"],
  "eye": ["/aɪ/"],
  "I": ["/aɪ/"],
  "knew": ["/n/", "/u:/"],
  "new": ["/n/", "/u:/"],
  "know": ["/n/", "/əʊ/"],
  "no": ["/n/", "/əʊ/"],
  "buy": ["/b/", "/aɪ/"],
  "by": ["/b/", "/aɪ/"],
  "bye": ["/b/", "/aɪ/"],
  "sea": ["/s/", "/i:/"],
  "see": ["/s/", "/i:/"]
};

function getAcousticSkeleton(word) {
  if (!word) return "";
  let w = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (w.length === 0) return "";

  if (w === "CHOIR" || w === "QUIRE") return "KR";

  let code = "";
  w = w.replace(/CH/g, "X");
  w = w.replace(/SH/g, "X");
  w = w.replace(/TH/g, "0");
  w = w.replace(/PH/g, "F");
  w = w.replace(/CK/g, "K");
  w = w.replace(/KN|GN|PN/g, "N");
  w = w.replace(/WR/g, "R");

  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const next = i < w.length - 1 ? w[i+1] : "";
    if (i > 0 && c === w[i-1] && c !== "C" && c !== "G") continue;

    switch (c) {
      case "B": case "P": code += "P"; break;
      case "C":
        if (next === "E" || next === "I" || next === "Y") code += "S";
        else code += "K";
        break;
      case "D": case "T": code += "T"; break;
      case "G":
        if (next === "E" || next === "I" || next === "Y") code += "J";
        else code += "K";
        break;
      case "K": case "Q": code += "K"; break;
      case "V": case "F": code += "F"; break;
      case "J": code += "J"; break;
      case "M": case "N": code += "N"; break;
      case "S": case "Z": code += "S"; break;
      case "W": if (i === 0) code += "W"; break;
      case "X": code += "KS"; break;
      case "L": code += "L"; break;
      case "R": code += "R"; break;
      case "Y": if (i === 0) code += "Y"; break;
      case "0": code += "0"; break;
    }
  }
  if (code === "" && w.length > 0) code = w[0];
  return code;
}

/* ── PROFANITY FILTER ───────────────────────────────────────── */

const PROFANITY_LIST = [
  "fuck", "shit", "piss", "cunt", "bitch", "asshole",
  "dick", "pussy", "bastard", "nigger", "faggot",
];

/**
 * Replace any banned word with a parrot emoji.
 * Returns { text, dirty } — dirty is true if any word was censored.
 * Preserves original case of non-censored text.
 */
function censor(raw) {
  let text  = (raw || "");
  let lower = text.toLowerCase();
  let dirty = false;
  for (let i = 0; i < PROFANITY_LIST.length; i++) {
    const word = PROFANITY_LIST[i];
    let idx = lower.indexOf(word);
    while (idx !== -1) {
      // Check word boundaries
      const beforeOk = idx === 0 || /\W/.test(lower[idx - 1]);
      const afterIdx = idx + word.length;
      const afterOk = afterIdx === lower.length || /\W/.test(lower[afterIdx]);
      if (beforeOk && afterOk) {
        text  = text.substring(0, idx) + "\uD83E\uDD9C" + text.substring(afterIdx);
        lower = lower.substring(0, idx) + "\uD83E\uDD9C" + lower.substring(afterIdx);
        dirty = true;
        idx = idx + 2; // skip past the emoji (2-char surrogate pair)
      } else {
        idx = idx + 1;
      }
      idx = lower.indexOf(word, idx);
    }
  }
  return { text: text, dirty: dirty };
}

/* ── LEVENSHTEIN DISTANCE ───────────────────────────────────── */

/**
 * Compute edit distance between two strings.
 * Used by Poem Builder for fuzzy matching of spoken words.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  // Use a flat typed array for speed
  const dp = new Uint16Array((m + 1) * (n + 1));
  for (var i = 0; i <= m; i++) dp[i * (n + 1)]     = i;
  for (var j = 0; j <= n; j++) dp[j]                = j;
  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * (n + 1) + j] = Math.min(
        dp[(i - 1) * (n + 1) + j] + 1,
        dp[i * (n + 1) + (j - 1)] + 1,
        dp[(i - 1) * (n + 1) + (j - 1)] + cost
      );
    }
  }
  return dp[m * (n + 1) + n];
}

function phoneticLevenshtein(rawA, rawB) {
  let a = getAcousticSkeleton(rawA);
  let b = getAcousticSkeleton(rawB);
  if (!a || !b) {
    a = rawA.toUpperCase();
    b = rawB.toUpperCase();
  }
  return levenshtein(a, b);
}

/* ── SPEECH SYNTHESIS HELPERS ──────────────────────────────── */

let _voicesCache = [];

function _loadVoices() {
  if (!window.speechSynthesis) return;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length > 0) _voicesCache = v;
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = _loadVoices;
  _loadVoices(); // try to load synchronously (works in Firefox)
}

/**
 * Pick the best available TTS voice for the given locale.
 * Prefers Google > Natural > Microsoft > exact lang match.
 * Falls back to any English voice, then voices[0].
 */
function getBestVoice(preferredLang) {
  preferredLang = preferredLang || "en-GB";
  // Refresh in case voices loaded after page init
  _loadVoices();
  const voices = _voicesCache;
  if (!voices || voices.length === 0) return null;
  const lang2 = preferredLang.split("-")[0]; // e.g. "en"

  // Prioritize local offline voices to avoid network drops or silent TTS failures
  const localVoices = voices.filter(function (v) { return v.localService === true; });
  const pool = localVoices.length > 0 ? localVoices : voices;

  // Prefer standard local system/Microsoft voices first (they run offline and never lag)
  // Avoid online-only Google voices if possible for stability
  return (
    pool.find(function (v) { return v.lang === preferredLang && v.name.indexOf("Google") === -1; }) ||
    pool.find(function (v) { return v.lang.startsWith(lang2) && v.name.indexOf("Google") === -1; }) ||
    pool.find(function (v) { return v.lang === preferredLang; }) ||
    pool.find(function (v) { return v.lang.startsWith(lang2); }) ||
    pool[0]
  );
}

/* ── MICROPHONE PERMISSION ──────────────────────────────────── */

/**
 * Request microphone access.
 * Properly stops the test stream so the mic indicator light goes off.
 * Calls onSuccess / onError accordingly.
 */
async function requestMicPermission(onSuccess, onError) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    // Stop all tracks immediately — we only needed the permission grant
    stream.getTracks().forEach(function (t) { t.stop(); });
    if (onSuccess) onSuccess();
    return true;
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      console.warn("[PhonicsParrot] Microphone access denied.", err.message);
      alert(
        "Microphone access denied!\n\n" +
        "Fix: Click the 🔒 lock icon in your browser's address bar\n" +
        "→ Microphone → Allow\n\n" +
        "Or: Windows Settings → Privacy → Microphone → Allow apps to access your microphone."
      );
    } else {
      console.warn("[PhonicsParrot] getUserMedia error:", err.name, err.message);
    }
    if (onError) onError(err);
    return false;
  }
}

/**
 * Non-intrusive check: returns true only if permission is already "granted".
 * Does NOT prompt the user.
 */
async function checkMicPermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: "microphone" });
      return result.state === "granted";
    }
  } catch (_) {
    // Permissions API not available (e.g. Firefox in some contexts)
  }
  return false;
}

/* ── PHONEME COLOUR UTILITY ─────────────────────────────────── */

/**
 * Generate a deterministic HSL colour from an IPA string.
 * Same IPA → same colour every time.
 */
function getPhonemeColor(ipa) {
  let hash = 0;
  for (let i = 0; i < ipa.length; i++) {
    hash = ipa.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // force 32-bit integer
  }
  const hue = Math.abs(hash) % 360;
  return "hsl(" + hue + ", 75%, 62%)";
}

/* ── LESSON DATA VALIDATION ─────────────────────────────────── */

/**
 * Returns true if CUSTOM_POEM has at least one tagged target word.
 */
function checkLessonData() {
  const raw = localStorage.getItem("CUSTOM_POEM");
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return false;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (d && d.targets && typeof d.targets === "object" &&
          Object.keys(d.targets).length > 0) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Display a fullscreen error overlay when no lesson data is loaded.
 * Appends an overlay to scale-root WITHOUT destroying existing layout/navigation.
 */
function showEmptyLessonError() {
  const root = document.getElementById("scale-root");
  if (!root) return;
  // Don't overwrite existing content — append overlay instead
  const overlay = document.createElement("div");
  overlay.id = "empty-lesson-overlay";
  overlay.style.cssText =
    "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;" +
    "justify-content:center;background:rgba(10,10,26,.96);z-index:9999;" +
    "text-align:center;padding:2rem;border-radius:1.5rem;" +
    "border:1px solid rgba(255,255,255,.08);";
  overlay.innerHTML =
    '<span style="font-size:5rem;animation:parrot-bob 2.5s ease-in-out infinite;">\uD83E\uDD9C</span>' +
    '<h2 style="color:#e94560;font-size:1.8rem;margin:1rem 0 .5rem;">No Active Lesson</h2>' +
    '<p style="opacity:.5;font-size:1rem;margin-bottom:1.5rem;max-width:400px;">' +
      'Please create a lesson and tag phonics words in the Teacher Dashboard before playing.' +
    '</p>' +
    '<button class="enable-btn" style="background:#2ec4b6!important;color:#000!important;' +
      'box-shadow:0 4px 20px rgba(46,196,182,.25)!important;" ' +
      'onclick="location.href=\'teacher.html\'">Open Dashboard</button>';
  root.appendChild(overlay);
}

/* ── DOM HELPER ─────────────────────────────────────────────── */

/** Shortcut for document.getElementById */
function $id(id) {
  return document.getElementById(id);
}

/* ── CENTRALIZED LESSON DATA LOADER (v7) ─────────────────── */

/**
 * Schema-validated lesson data loader.
 * All activities MUST use this instead of parsing CUSTOM_POEM directly.
 */
function loadLessonData() {
  try {
    const raw = localStorage.getItem("CUSTOM_POEM");
    if (!raw) return { ok: false, error: "No lesson data stored." };
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: "Lesson data is empty or invalid." };
    }
    const phonemeSet = {};
    for (let i = 0; i < data.length; i++) {
      const line = data[i];
      if (!line || typeof line.text !== "string" || typeof line.targets !== "object") {
        return { ok: false, error: "Corrupt line at index " + i };
      }
      const words = Object.keys(line.targets);
      for (let wi = 0; wi < words.length; wi++) {
        phonemeSet[line.targets[words[wi]]] = true;
      }
    }
    return { ok: true, data: data, phonemes: Object.keys(phonemeSet) };
  } catch (e) {
    return { ok: false, error: "Failed to parse lesson data: " + e.message };
  }
}

/* ── GRAPHEME-TO-PHONEME MAPPING (v7) ─────────────────────── */

/**
 * Check if a word CONTAINS the sound represented by an IPA phoneme.
 * Uses grapheme matching — checks if any spelling pattern for the
 * phoneme appears within the word using precise regex heuristics.
 */
let _cachedPoemRaw = null;
let _cachedPoem = null;

function wordHasPhoneme(word, ipa) {
  word = word.toLowerCase().trim().replace(/[^\w]/g, "");
  if (!word) return false;
  // If the word equals the target sound, count it (e.g. "a" = "a")
  if (word === ipa.toLowerCase()) return true;
  try {
    const raw = localStorage.getItem("CUSTOM_POEM");
    if (raw) {
      if (raw !== _cachedPoemRaw) {
        _cachedPoem = JSON.parse(raw);
        _cachedPoemRaw = raw;
      }
      const poem = _cachedPoem;
      for (let i = 0; i < poem.length; i++) {
        const targets = poem[i].targets || {};
        if (targets[word] === ipa) {
          return true;
        }
      }
    }
  } catch(e) { console.error(e); }
  return false;
}

/* ── PERFORMANCE LOGGING (v7) ─────────────────────────────── */

/**
 * Log a performance event for auto-keying.
 * Saves to Google Sheets (if configured) and local JSON fallback.
 */
function logPerformance(entry) {
  entry.teacher = sessionStorage.getItem("PP_TEACHER_NAME") || "guest";
  entry.class = sessionStorage.getItem("PP_CLASS_NAME") || "guest";
  entry.student = sessionStorage.getItem("PP_STUDENT_NAME") || "guest";
  entry.timestamp = new Date().toISOString();
  entry.sessionId = Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  window._lastPerformanceEntry = entry;

  // Always save to local JSON fallback in localStorage
  let log = [];
  try {
    const existing = localStorage.getItem("PP_PERFORMANCE_LOG");
    if (existing) log = JSON.parse(existing);
  } catch (e) {}
  log.push(entry);
  if (log.length > 500) log = log.slice(-500);
  try {
    localStorage.setItem("PP_PERFORMANCE_LOG", JSON.stringify(log));
  } catch (e) {}

  // Save to local performance_log.json file (Tauri or local server)
  const isTauri = typeof window.__TAURI__ !== "undefined";
  const logContent = JSON.stringify(entry);
  
  if (isTauri) {
    window.__TAURI__.core.invoke("save_local_log", {
      filename: "performance_log.json",
      content: logContent
    }).catch(function (err) {
      console.error("Local log via Tauri failed:", err);
    });
  } else {
    fetch("/api/save-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: logContent
    }).catch(function (err) {
      console.log("Local log via dev server not available:", err.message);
    });
  }

  // If Google Sheets is configured, also send there
  sendToGoogleSheets(entry);
}

/**
 * Send a performance entry to Google Sheets (if configured).
 */
async function sendToGoogleSheets(entry) {
  try {
    const gsUrl = localStorage.getItem("PP_GSHEET_URL");
    if (!gsUrl) return;
    
    // Check if it's an Apps Script Web App URL
    if (gsUrl.indexOf("script.google.com") !== -1) {
      const payload = JSON.stringify(entry);
      await fetch(gsUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: payload
      });
      return;
    }
    
    // Otherwise, try to use Google Sheets API with Service Account
    const saJson = localStorage.getItem("PP_GSHEET_SA");
    if (!saJson) return;
    
    if (!window.crypto || !window.crypto.subtle) {
      console.warn("[PhonicsParrot] Sheets API requires secure context (HTTPS/localhost) for Service Account signing.");
      return;
    }
    
    const spreadsheetId = extractSpreadsheetId(gsUrl);
    if (!spreadsheetId) return;
    
    const rowData = [
      entry.timestamp,
      entry.student,
      entry.teacher,
      entry.activity || "",
      entry.target || "",
      entry.phoneme || "",
      entry.spoken || "",
      entry.score !== undefined && entry.score !== null ? entry.score : "",
      entry.verdict || ""
    ];
    
    await appendRowToGoogleSheet(spreadsheetId, saJson, rowData);
    console.log("Logged to Google Sheets successfully via Sheets API");
  } catch (e) {
    console.warn("Failed to send performance to Google Sheets:", e.message);
  }
}

function extractSpreadsheetId(url) {
  const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}

function pemToDer(pem) {
  const base64 = pem
    .replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleSheetsAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  
  const base64UrlHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const base64UrlClaim = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const stringToSign = base64UrlHeader + "." + base64UrlClaim;
  const encoder = new TextEncoder();
  const dataToSign = encoder.encode(stringToSign);
  
  const cryptoKey = await window.crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  
  const signature = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    dataToSign
  );
  
  const base64UrlSignature = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
    
  const jwt = stringToSign + "." + base64UrlSignature;
  
  const tokenResponse = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt
  });
  
  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }
  return tokenData.access_token;
}

async function appendRowToGoogleSheet(spreadsheetId, serviceAccountJson, rowData) {
  const accessToken = await getGoogleSheetsAccessToken(serviceAccountJson);
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadsheetId + "/values/A:I:append?valueInputOption=USER_ENTERED";
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [rowData]
    })
  });
  
  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result;
}

/* ── VOICE RECORDING SAVE (v7) ─────────────────────────────── */

/**
 * Save a recorded audio blob with folder structure:
 * recordings/<student>/<YYYY-MM-DD>/<activity>_<timestamp>.webm
 */
async function saveRecording(blob, activity, phrase) {
  try {
    let className = sessionStorage.getItem("PP_CLASS_NAME") || "guest";
    className = className.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
    let student = sessionStorage.getItem("PP_STUDENT_NAME") || "guest";
    student = student.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
    
    const now = new Date();
    const dateStr = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
    const timeStr = String(now.getHours()).padStart(2, "0") + "-" +
      String(now.getMinutes()).padStart(2, "0") + "-" +
      String(now.getSeconds()).padStart(2, "0");
      
    let cleanPhrase = (phrase || "recording").trim().toLowerCase().replace(/[^a-zA-Z0-9-_]/g, "_");
    if (cleanPhrase.length > 30) cleanPhrase = cleanPhrase.substring(0, 30);
    const filename = student + "_[" + cleanPhrase + "]_" + timeStr + ".webm";

    const isTauri = typeof window.__TAURI__ !== "undefined";
    
    if (isTauri) {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);
        
        await window.__TAURI__.core.invoke("save_audio_recording", {
          student: student,
          date: dateStr,
          filename: filename,
          data: Array.from(byteArray)
        });
        console.log("Audio recording saved silently via Tauri");
        return;
      } catch (err) {
        console.error("Tauri save_audio_recording failed:", err);
      }
    }
    
    // Browser local server API — saves locally AND optionally to Google Drive
    try {
      // NOTE: class is included so Apps Script's patchLastRowDriveUrl can find
      // the correct sheet tab and patch the Drive URL into the right row.
      const rawClass = sessionStorage.getItem("PP_CLASS_NAME") || "guest";
      const lastEntry = window._lastPerformanceEntry || {};
      const queryStr = "?class=" + encodeURIComponent(rawClass) +
                    "&student=" + encodeURIComponent(student) +
                    "&activity=" + encodeURIComponent(activity) +
                    "&phrase=" + encodeURIComponent(phrase || "") +
                    "&filename=" + encodeURIComponent(filename) +
                    "&target=" + encodeURIComponent(lastEntry.target || phrase || "") +
                    "&phoneme=" + encodeURIComponent(lastEntry.phoneme || "") +
                    "&spoken=" + encodeURIComponent(lastEntry.spoken || "") +
                    "&score=" + encodeURIComponent(lastEntry.score !== undefined ? lastEntry.score : "") +
                    "&verdict=" + encodeURIComponent(lastEntry.verdict || "") +
                    "&sessionId=" + encodeURIComponent(lastEntry.sessionId || "");

      // Local save (always attempted)
      const response = await fetch("/api/save-recording" + queryStr, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob
      });
      if (response.ok) {
        console.log("Audio recording saved locally via dev server API");
      }

      // Drive upload — fire and forget, but log errors visibly
      fetch("/api/save-recording-drive" + queryStr, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
        keepalive: true
      }).then(function(r) {
        if (r.ok) {
          r.json().then(function(d) {
            let url = d.driveUrl;
            if (!url && d.driveResponse) {
              try { url = typeof d.driveResponse === "object" ? d.driveResponse.driveUrl : JSON.parse(d.driveResponse).driveUrl; } catch(_) { /* ignore */ }
            }
            if (url) {
              console.log("[Drive] Recording uploaded:", url);
            } else {
              console.warn("[Drive] Upload OK but no URL returned:", d);
            }
          }).catch(function() {
            console.log("[Drive] Recording uploaded to Google Drive");
          });
        } else {
          r.text().then(function(t) {
            console.warn("[Drive] Upload failed (HTTP " + r.status + "):", t.slice(0, 200));
          }).catch(function() {
            console.warn("[Drive] Upload failed with HTTP", r.status);
          });
        }
      }).catch(function(err) {
        console.warn("[Drive] Upload request error (Drive may not be configured):", err && err.message);
      });

      if (response.ok) return;

    } catch (err) {
      console.log("Dev server API recording save not available:", err.message);
    }

    // Fallback: Browser download
    const activityMap = {
      "builder": "flashcard_builder",
      "reader": "line_reader",
      "speak": "poem_builder",
      "pingpong": "phonics_pong"
    };
    const folderName = activityMap[activity] || activity;
    const relativePath = className + "/" + student + "/" + folderName + "/" + filename;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = relativePath.replace(/\//g, "_");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    console.log("Audio recording saved via browser download fallback");
  } catch (e) {
    console.error("saveRecording failed:", e);
  }
}

/* ── GLOBAL ERROR BOUNDARY (v7) ────────────────────────────── */

window.addEventListener("error", function (event) {
  console.error("Unhandled error captured:", event.error);
  showGlobalErrorOverlay(event.error ? event.error.message : event.message);
});

window.addEventListener("unhandledrejection", function (event) {
  console.error("Unhandled promise rejection:", event.reason);
  showGlobalErrorOverlay(event.reason ? event.reason.message || event.reason : "Promise rejection");
});

function showGlobalErrorOverlay(message) {
  if (document.getElementById("global-error-overlay")) return;

  const div = document.createElement("div");
  div.id = "global-error-overlay";
  div.style.cssText = 
    "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;" +
    "justify-content:center;background:rgba(10,10,26,.98);z-index:99999;" +
    "text-align:center;padding:2rem;font-family:system-ui,-apple-system,sans-serif;";
    
  div.innerHTML = 
    "<span style='font-size:4rem;'>🦜</span>" +
    "<h2 style='color:#e94560;font-size:1.8rem;margin:1rem 0 .5rem;'>Something went wrong</h2>" +
    "<p style='opacity:.7;font-size:0.95rem;margin-bottom:1.5rem;max-width:500px;line-height:1.5;'>" +
      "Phonics Parrot encountered an unexpected error. This might be due to corrupted data in your settings." +
    "</p>" +
    "<div style='background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);padding:0.8rem;border-radius:0.5rem;margin-bottom:1.5rem;max-width:500px;overflow-x:auto;font-family:monospace;font-size:0.8rem;color:#ff7b00;width:100%;text-align:left;'>" +
      message +
    "</div>" +
    "<div style='display:flex;gap:1rem;justify-content:center;'>" +
      "<button id='err-reset-btn' style='background:#e94560!important;color:#fff!important;box-shadow:0 4px 20px rgba(233,69,96,.25)!important;padding:0.6rem 1.5rem;font-size:0.9rem;border-radius:0.5rem;border:none;cursor:pointer;font-weight:700;'>Reset App Data</button>" +
      "<button id='err-reload-btn' style='background:#2ec4b6!important;color:#000!important;box-shadow:0 4px 20px rgba(46,196,182,.25)!important;padding:0.6rem 1.5rem;font-size:0.9rem;border-radius:0.5rem;border:none;cursor:pointer;font-weight:700;'>Reload Page</button>" +
    "</div>";
    
  document.body.appendChild(div);
  
  document.getElementById("err-reset-btn").onclick = function () {
    if (confirm("This will reset all your lessons and settings to defaults. Are you sure?")) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };
  
  document.getElementById("err-reload-btn").onclick = function () {
    window.location.reload();
  };
}

/* ── CUSTOM BUBBLY ALERT MODAL ────────────────────────────── */

window.alert = function (message) {
  let overlay = document.getElementById("custom-alert-modal");
  const currentPath = window.location.pathname;
  let mascotPath = "assets/img/mascot.png?v=2";
  if (currentPath.indexOf("activities/") !== -1) {
    mascotPath = "../assets/img/mascot.png?v=2";
  }

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "custom-alert-modal";
    overlay.className = "custom-modal-overlay";
    overlay.innerHTML = 
      '<div class="custom-modal-card">' +
      '  <div style="display:flex;justify-content:center;margin-bottom:0.8rem;position:relative;">' +
      '    <img class="custom-modal-mascot-img" src="' + mascotPath + '" style="width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 4px 0 #1e293b);animation:parrot-bob 1.8s infinite ease-in-out;">' +
      '    <span class="custom-modal-mic-badge" style="display:none;position:absolute;bottom:-5px;right:calc(50% - 45px);font-size:1.8rem;">🎤</span>' +
      '  </div>' +
      '  <div class="custom-modal-title" id="custom-alert-title">Phonics Parrot Says</div>' +
      '  <div class="custom-modal-msg" id="custom-alert-msg"></div>' +
      '  <button class="custom-modal-btn" id="custom-alert-btn">OK</button>' +
      '</div>';
    document.body.appendChild(overlay);
    
    document.getElementById("custom-alert-btn").onclick = function () {
      overlay.classList.remove("show");
    };
  }
  
  document.getElementById("custom-alert-msg").textContent = message;
  
  const titleEl = document.getElementById("custom-alert-title");
  const micBadge = overlay.querySelector(".custom-modal-mic-badge");
  
  if (message.toLowerCase().indexOf("microphone") !== -1 || message.toLowerCase().indexOf("mic") !== -1) {
    titleEl.textContent = "Microphone Help! 🎤";
    if (micBadge) micBadge.style.display = "block";
  } else {
    titleEl.textContent = "Phonics Parrot Says";
    if (micBadge) micBadge.style.display = "none";
  }
  
  setTimeout(function() {
    overlay.classList.add("show");
  }, 50);
};

/* ── WEBGL SKY GRADIENT SHADER ────────────────────────────── */

function initBgShader(canvas) {
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return;
  
  function syncSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener("resize", syncSize);
  syncSize();

  const vs = "attribute vec2 a_position; varying vec2 v_texCoord; void main() { v_texCoord = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }";
  const fs = "precision highp float; varying vec2 v_texCoord; uniform float u_time; void main() { vec2 uv = v_texCoord; vec3 skyTop = vec3(0.729, 0.902, 0.992); vec3 skyMid = vec3(0.941, 0.937, 0.992); vec3 skyBottom = vec3(0.996, 0.976, 0.765); vec3 color = mix(skyBottom, skyMid, uv.y * 1.5); color = mix(color, skyTop, clamp((uv.y - 0.5) * 2.0, 0.0, 1.0)); float bubble = sin(uv.x * 10.0 + u_time * 0.3) * cos(uv.y * 10.0 + u_time * 0.2); color += bubble * 0.015; gl_FragColor = vec4(color, 1.0); }";

  function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, "u_time");

  function render(t) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
}

document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("bg-shader-canvas");
  if (canvas) {
    initBgShader(canvas);
  }
});




function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255);
}

if (typeof module !== 'undefined' && module.exports) {

  module.exports = {
    hexToRgb: hexToRgb
  };
}
