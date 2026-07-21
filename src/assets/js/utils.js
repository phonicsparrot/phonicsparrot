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

/* ── ACOUSTIC PHONETIC ALGORITHM ────────────────────────────── */

/**
 * Computes a robust phonetic encoding for a word to evaluate acoustic similarity.
 * Preserves vowel distinctions to keep Levenshtein edit distances accurate
 * (so "cat" != "cot" != "cut") while collapsing tricky homophones and digraphs.
 */
function phoneticEncode(word) {
  if (!word) return "";
  var w = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (w.length === 0) return "";

  var code = "";
  var isVowel = function(c) { return "AEIOUY".indexOf(c) > -1; };

  // 0. Hardcoded Homophone exceptions for KSSR edge cases
  if (w === "CHOIR" || w === "QUIRE") return "KWAR";
  if (w === "WEIGH" || w === "WAY") return "WA";
  if (w === "READ") return "RID"; // Assume present tense /ri:d/ for Year 1
  if (w === "RED") return "RED";
  if (w === "TWO" || w === "TOO" || w === "TO") return "TU";

  // 1. Handle Vowels (Crucial for Phonics)
  w = w.replace(/EE|EA|IE|EI/g, "I"); // Long E sound family
  w = w.replace(/OO/g, "U");          // Long U sound family
  w = w.replace(/AI|AY|EIGH/g, "A");  // Long A sound family
  w = w.replace(/OA|OW/g, "O");       // Long O sound family
  w = w.replace(/OU|OW/g, "W");       // Ow sound
  w = w.replace(/OI|OY/g, "Y");       // Oy sound

  // 2. Handle Consonant Digraphs and Clusters
  w = w.replace(/CH/g, "X");          // Ch -> X
  w = w.replace(/SH/g, "X");          // Sh -> X
  w = w.replace(/TH/g, "0");          // Th -> 0
  w = w.replace(/PH/g, "F");          // Ph -> F
  w = w.replace(/WH/g, "W");          // Wh -> W
  w = w.replace(/CK/g, "K");          // Ck -> K
  w = w.replace(/KN|GN|PN/g, "N");    // Kn/Gn/Pn -> N
  w = w.replace(/WR/g, "R");          // Wr -> R
  w = w.replace(/MB$/g, "M");         // Mb at end -> M

  // 3. Main encoding loop
  for (var i = 0; i < w.length; i++) {
    var c = w[i];
    var next = i < w.length - 1 ? w[i+1] : "";

    // Skip duplicate letters to tighten the phonetic string
    if (i > 0 && c === w[i-1] && c !== "C" && c !== "G") continue;

    switch (c) {
      case "A": case "E": case "I": case "O": case "U": case "Y":
        // Keep vowels distinct to prevent "cat" == "cot" == "cut"
        if (i > 0 && isVowel(w[i-1])) continue; // compress adjacent unhandled vowels
        else code += c;
        break;
      case "B": code += "B"; break; // Keep voiced/unvoiced separate for accurate phonics
      case "P": code += "P"; break;
      case "C":
        if (next === "E" || next === "I" || next === "Y") code += "S";
        else code += "K";
        break;
      case "D": code += "D"; break;
      case "T": code += "T"; break;
      case "G":
        if (next === "E" || next === "I" || next === "Y") code += "J";
        else code += "G";
        break;
      case "K": case "Q": code += "K"; break;
      case "H":
        if (i > 0 && isVowel(w[i-1]) && !isVowel(next)) continue; // silent H
        code += "H";
        break;
      case "V": code += "V"; break;
      case "F": code += "F"; break;
      case "J": code += "J"; break;
      case "M": code += "M"; break;
      case "N": code += "N"; break;
      case "S": case "Z": code += "S"; break; // Z and S collapse often in speech recognition text
      case "W": code += "W"; break;
      case "X": code += "KS"; break;
      case "L": code += "L"; break;
      case "R": code += "R"; break;
      case "0": code += "0"; break; // TH
      default: code += c;
    }
  }

  // 4. Final Cleanup
  // Strip trailing silent E
  if (code.length > 2 && code.endsWith("E") && !isVowel(code[code.length-2])) {
    code = code.substring(0, code.length - 1);
  }

  if (code.length === 0 && w.length > 0) code = w[0]; // failsafe
  return code;
}

/* ── PROFANITY FILTER ───────────────────────────────────────── */

var PROFANITY_LIST = [
  "fuck", "shit", "piss", "cunt", "bitch", "asshole",
  "dick", "pussy", "bastard", "nigger", "faggot",
];

/**
 * Replace any banned word with a parrot emoji.
 * Returns { text, dirty } — dirty is true if any word was censored.
 * Preserves original case of non-censored text.
 */
function censor(raw) {
  var text  = (raw || "");
  var lower = text.toLowerCase();
  var dirty = false;
  for (var i = 0; i < PROFANITY_LIST.length; i++) {
    var word = PROFANITY_LIST[i];
    var idx = lower.indexOf(word);
    while (idx !== -1) {
      // Check word boundaries
      var beforeOk = idx === 0 || /\W/.test(lower[idx - 1]);
      var afterIdx = idx + word.length;
      var afterOk = afterIdx === lower.length || /\W/.test(lower[afterIdx]);
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
 * Compute acoustic edit distance between two strings.
 * Overhauled to use phonetic encodes rather than raw graphemes.
 * Used by Poem Builder and Phonics Pong for fuzzy matching of spoken words.
 */
function levenshtein(rawA, rawB) {
  var a = phoneticEncode(rawA);
  var b = phoneticEncode(rawB);

  // Fallback to basic string comparison if phonetic encoder yields nothing
  if (!a || !b) {
    a = rawA.toUpperCase();
    b = rawB.toUpperCase();
  }

  var m = a.length;
  var n = b.length;
  // Use a flat typed array for speed
  var dp = new Uint16Array((m + 1) * (n + 1));
  for (var i = 0; i <= m; i++) dp[i * (n + 1)]     = i;
  for (var j = 0; j <= n; j++) dp[j]                = j;
  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      var cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * (n + 1) + j] = Math.min(
        dp[(i - 1) * (n + 1) + j] + 1,
        dp[i * (n + 1) + (j - 1)] + 1,
        dp[(i - 1) * (n + 1) + (j - 1)] + cost
      );
    }
  }
  return dp[m * (n + 1) + n];
}

/* ── SPEECH SYNTHESIS HELPERS ──────────────────────────────── */

var _voicesCache = [];

function _loadVoices() {
  if (!window.speechSynthesis) return;
  var v = window.speechSynthesis.getVoices();
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
  var voices = _voicesCache;
  if (!voices || voices.length === 0) return null;
  var lang2 = preferredLang.split("-")[0]; // e.g. "en"

  // Prioritize local offline voices to avoid network drops or silent TTS failures
  var localVoices = voices.filter(function (v) { return v.localService === true; });
  var pool = localVoices.length > 0 ? localVoices : voices;

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
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
      var result = await navigator.permissions.query({ name: "microphone" });
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
  var hash = 0;
  for (var i = 0; i < ipa.length; i++) {
    hash = ipa.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // force 32-bit integer
  }
  var hue = Math.abs(hash) % 360;
  return "hsl(" + hue + ", 75%, 62%)";
}

/* ── LESSON DATA VALIDATION ─────────────────────────────────── */

/**
 * Returns true if CUSTOM_POEM has at least one tagged target word.
 */
function checkLessonData() {
  var raw = localStorage.getItem("CUSTOM_POEM");
  if (!raw) return false;
  try {
    var data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) return false;
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
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
  var root = document.getElementById("scale-root");
  if (!root) return;
  // Don't overwrite existing content — append overlay instead
  var overlay = document.createElement("div");
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
    var raw = localStorage.getItem("CUSTOM_POEM");
    if (!raw) return { ok: false, error: "No lesson data stored." };
    var data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, error: "Lesson data is empty or invalid." };
    }
    var phonemeSet = {};
    for (var i = 0; i < data.length; i++) {
      var line = data[i];
      if (!line || typeof line.text !== "string" || typeof line.targets !== "object") {
        return { ok: false, error: "Corrupt line at index " + i };
      }
      var words = Object.keys(line.targets);
      for (var wi = 0; wi < words.length; wi++) {
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
 * Overhauled to check acoustics via phoneticEncode instead of literal
 * string matching to support homophones and acoustic similarity.
 */
function wordHasPhoneme(word, ipa) {
  word = word.toLowerCase().trim().replace(/[^\w]/g, "");
  if (!word) return false;

  // 1. Check if this exact word has been tagged with this exact ipa in localStorage CUSTOM_POEM
  try {
    var raw = localStorage.getItem("CUSTOM_POEM");
    if (raw) {
      var poem = JSON.parse(raw);
      for (var i = 0; i < poem.length; i++) {
        var targets = poem[i].targets || {};
        if (targets[word] === ipa) {
          return true;
        }
      }
    }
  } catch (e) {}

  // 2. Acoustic matching using phoneticEncode
  var code = phoneticEncode(word);
  var normIpa = ipa.replace("ː", ":"); 

  switch (normIpa) {
    case "/eɪ/": return code.indexOf("A") > -1;
    case "/aɪ/": return code.indexOf("A") > -1 || code.indexOf("Y") > -1 || code.indexOf("I") > -1;
    case "/i:/": return code.indexOf("I") > -1;
    case "/ɔɪ/": return code.indexOf("Y") > -1 || code.indexOf("O") > -1;
    case "/ɪ/": return code.indexOf("I") > -1 || code.indexOf("E") > -1;
    case "/ʊ/": return code.indexOf("U") > -1;
    case "/u:/": return code.indexOf("U") > -1;
    case "/e/": return code.indexOf("E") > -1 || code.indexOf("A") > -1;
    case "/æ/": return code.indexOf("A") > -1;
    case "/ʌ/": return code.indexOf("U") > -1 || code.indexOf("O") > -1;
    case "/ɑ:/":
    case "/ɑː/": return code.indexOf("A") > -1 || code.indexOf("R") > -1;
    case "/ɒ/": return code.indexOf("O") > -1;
    case "/ɪə/": return code.indexOf("I") > -1 || code.indexOf("R") > -1;
    case "/ʊə/": return code.indexOf("U") > -1 || code.indexOf("R") > -1;
    case "/eə/": return code.indexOf("E") > -1 || code.indexOf("A") > -1 || code.indexOf("R") > -1;
    case "/əʊ/": return code.indexOf("O") > -1 || code.indexOf("W") > -1;
    case "/aʊ/": return code.indexOf("O") > -1 || code.indexOf("W") > -1;

    // Consonants
    case "/p/": return code.indexOf("P") > -1;
    case "/b/": return code.indexOf("B") > -1;
    case "/t/": return code.indexOf("T") > -1;
    case "/d/": return code.indexOf("D") > -1;
    case "/k/": return code.indexOf("K") > -1 || code.indexOf("X") > -1; // Sometimes mapped to X in some dialects
    case "/g/": return code.indexOf("G") > -1;
    case "/f/": return code.indexOf("F") > -1;
    case "/v/": return code.indexOf("V") > -1;
    case "/s/": return code.indexOf("S") > -1;
    case "/z/": return code.indexOf("S") > -1 || code.indexOf("Z") > -1;
    case "/θ/": return code.indexOf("0") > -1;
    case "/ð/": return code.indexOf("0") > -1;
  case "/ʃ/": return code.indexOf("X") > -1 || code.indexOf("S") > -1;
  case "/ʒ/": return code.indexOf("X") > -1 || code.indexOf("J") > -1 || code.indexOf("S") > -1;
    case "/h/": return code.indexOf("H") > -1;
    case "/m/": return code.indexOf("M") > -1;
    case "/n/": return code.indexOf("N") > -1;
    case "/ŋ/": return code.indexOf("N") > -1 || code.indexOf("G") > -1;
    case "/l/": return code.indexOf("L") > -1;
    case "/r/": return code.indexOf("R") > -1;
    case "/w/": return code.indexOf("W") > -1;
    case "/j/": return code.indexOf("Y") > -1 || code.indexOf("J") > -1;
    case "/tʃ/": return code.indexOf("X") > -1 || code.indexOf("T") > -1;
    case "/dʒ/": return code.indexOf("J") > -1;
  }

  // Fallback to literal if unhandled
  return word.indexOf(normIpa.replace(/\//g, "")) > -1 || /a|e|i|o|u/.test(word);
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
  var log = [];
  try {
    var existing = localStorage.getItem("PP_PERFORMANCE_LOG");
    if (existing) log = JSON.parse(existing);
  } catch (e) {}
  log.push(entry);
  if (log.length > 500) log = log.slice(-500);
  try {
    localStorage.setItem("PP_PERFORMANCE_LOG", JSON.stringify(log));
  } catch (e) {}

  // Save to local performance_log.json file (Tauri or local server)
  var isTauri = typeof window.__TAURI__ !== "undefined";
  var logContent = JSON.stringify(entry);
  
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
    var gsUrl = localStorage.getItem("PP_GSHEET_URL");
    if (!gsUrl) return;
    
    // Check if it's an Apps Script Web App URL
    if (gsUrl.indexOf("script.google.com") !== -1) {
      var payload = JSON.stringify(entry);
      await fetch(gsUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: payload
      });
      return;
    }
    
    // Otherwise, try to use Google Sheets API with Service Account
    var saJson = localStorage.getItem("PP_GSHEET_SA");
    if (!saJson) return;
    
    if (!window.crypto || !window.crypto.subtle) {
      console.warn("[PhonicsParrot] Sheets API requires secure context (HTTPS/localhost) for Service Account signing.");
      return;
    }
    
    var spreadsheetId = extractSpreadsheetId(gsUrl);
    if (!spreadsheetId) return;
    
    var rowData = [
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
  var matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}

function pemToDer(pem) {
  var base64 = pem
    .replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  var binary = window.atob(base64);
  var len = binary.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleSheetsAccessToken(serviceAccountJson) {
  var sa = JSON.parse(serviceAccountJson);
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: "RS256", typ: "JWT" };
  var claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  
  var base64UrlHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  var base64UrlClaim = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  var stringToSign = base64UrlHeader + "." + base64UrlClaim;
  var encoder = new TextEncoder();
  var dataToSign = encoder.encode(stringToSign);
  
  var cryptoKey = await window.crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  
  var signature = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    dataToSign
  );
  
  var base64UrlSignature = btoa(String.fromCharCode.apply(null, new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
    
  var jwt = stringToSign + "." + base64UrlSignature;
  
  var tokenResponse = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt
  });
  
  var tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }
  return tokenData.access_token;
}

async function appendRowToGoogleSheet(spreadsheetId, serviceAccountJson, rowData) {
  var accessToken = await getGoogleSheetsAccessToken(serviceAccountJson);
  var url = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadsheetId + "/values/A:I:append?valueInputOption=USER_ENTERED";
  
  var response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [rowData]
    })
  });
  
  var result = await response.json();
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
    var className = sessionStorage.getItem("PP_CLASS_NAME") || "guest";
    className = className.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
    var student = sessionStorage.getItem("PP_STUDENT_NAME") || "guest";
    student = student.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
    
    var now = new Date();
    var dateStr = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
    var timeStr = String(now.getHours()).padStart(2, "0") + "-" +
      String(now.getMinutes()).padStart(2, "0") + "-" +
      String(now.getSeconds()).padStart(2, "0");
      
    var cleanPhrase = (phrase || "recording").trim().toLowerCase().replace(/[^a-zA-Z0-9-_]/g, "_");
    if (cleanPhrase.length > 30) cleanPhrase = cleanPhrase.substring(0, 30);
    var filename = student + "_[" + cleanPhrase + "]_" + timeStr + ".webm";

    var isTauri = typeof window.__TAURI__ !== "undefined";
    
    if (isTauri) {
      try {
        var arrayBuffer = await blob.arrayBuffer();
        var byteArray = new Uint8Array(arrayBuffer);
        
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
      var rawClass = sessionStorage.getItem("PP_CLASS_NAME") || "guest";
      var lastEntry = window._lastPerformanceEntry || {};
      var queryStr = "?class=" + encodeURIComponent(rawClass) +
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
      var response = await fetch("/api/save-recording" + queryStr, {
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
            var url = d.driveUrl;
            if (!url && d.driveResponse) {
              try { url = typeof d.driveResponse === "object" ? d.driveResponse.driveUrl : JSON.parse(d.driveResponse).driveUrl; } catch(_) {}
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
    var activityMap = {
      "builder": "flashcard_builder",
      "reader": "line_reader",
      "speak": "poem_builder",
      "pingpong": "phonics_pong"
    };
    var folderName = activityMap[activity] || activity;
    var relativePath = className + "/" + student + "/" + folderName + "/" + filename;
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
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

  var div = document.createElement("div");
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
  var overlay = document.getElementById("custom-alert-modal");
  var currentPath = window.location.pathname;
  var mascotPath = "assets/img/mascot.png?v=2";
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
  
  var titleEl = document.getElementById("custom-alert-title");
  var micBadge = overlay.querySelector(".custom-modal-mic-badge");
  
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
  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return;
  
  function syncSize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener("resize", syncSize);
  syncSize();

  var vs = "attribute vec2 a_position; varying vec2 v_texCoord; void main() { v_texCoord = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }";
  var fs = "precision highp float; varying vec2 v_texCoord; uniform float u_time; void main() { vec2 uv = v_texCoord; vec3 skyTop = vec3(0.729, 0.902, 0.992); vec3 skyMid = vec3(0.941, 0.937, 0.992); vec3 skyBottom = vec3(0.996, 0.976, 0.765); vec3 color = mix(skyBottom, skyMid, uv.y * 1.5); color = mix(color, skyTop, clamp((uv.y - 0.5) * 2.0, 0.0, 1.0)); float bubble = sin(uv.x * 10.0 + u_time * 0.3) * cos(uv.y * 10.0 + u_time * 0.2); color += bubble * 0.015; gl_FragColor = vec4(color, 1.0); }";

  function compileShader(type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  var pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  var uTime = gl.getUniformLocation(prog, "u_time");

  function render(t) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
}

document.addEventListener("DOMContentLoaded", function () {
  var canvas = document.getElementById("bg-shader-canvas");
  if (canvas) {
    initBgShader(canvas);
  }
});

