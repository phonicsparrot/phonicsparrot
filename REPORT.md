# Phonics Parrot: Architectural and QA Review

## 1. Project Overview

**Project Goal:**
Phonics Parrot is a voice-interactive web application designed for KSSR Year 1–2 Language Arts in primary school classrooms. Its core objective is to provide real-time, STT-driven feedback on students' English pronunciation, focusing on phonics and phonemic awareness.

**Core Features & Activities:**
- **Zero Scrollbars:** UI is fixed to a 16:9 ratio (1280x720) ensuring compatibility across classroom devices and projectors.
- **Voice-Interactive Feedback:** Students use a microphone to interact with the system. It leverages offline/online Speech-to-Text (STT) for pronunciation evaluation.
- **Activity Suite:**
  1. **Flashcard Builder (`builder.html`):** Single-word practice.
  2. **Poem Builder (`speak.html`):** STT verification of constructed poems.
  3. **Line Reader (`reader.html`):** Full-line reading accuracy.
  4. **Phonics Pong (`pingpong.html`):** A gamified 2-player activity where voice inputs control in-game paddles.
- **Data Persistence & Classroom Management:**
  - Local recording storage via a Node.js proxy server.
  - Optional Google Sheets/Drive integration (via Apps Script) for teachers to log performance and archive audio.
  - Cross-activity tracking using a teacher dashboard.

## 2. File Mapping & Architecture

The architecture relies on a local Node.js server serving static assets while proxying data to Google Services.

1. **`src/index.html` (The Hub)**
   - **Role:** Main navigation gateway. Contains routes to the four core activities and the teacher dashboard.
   - **Interaction:** Uses JavaScript (`layout.js`) to scale the interface. Dynamically fetches phoneme chips from `localStorage` set by the Teacher Dashboard to adapt the hub's UI to the current lesson plan.

2. **`server.js` (Local Dev & Proxy Server)**
   - **Role:** A lightweight Node server acting as a middleman.
   - **Interaction:**
     - Serves the frontend web application locally on port 3000.
     - Provides an endpoint (`/api/save-recording`) to stream webm microphone data directly to local filesystem folders structured by `Class/Student/Activity`.
     - Provides endpoints (`/api/save-log` & `/api/save-recording-drive`) that act as CORS proxies forwarding JSON performance payloads and Base64-encoded audio to the Google Apps Script Web App URL (configured via `drive_config.json`).
     - Includes a local Whisper fallback via `/api/transcribe` if the machine is offline, calling an external binary (`bin/whisper/whisper-cli.exe`).

3. **`appsscript/Code.gs` (Cloud Logger)**
   - **Role:** The Google Apps Script deployed as a Web App that receives proxied HTTP POST requests from `server.js`.
   - **Interaction:**
     - Evaluates the incoming JSON payload.
     - Uploads Base64 audio into a structured hierarchy in Google Drive.
     - Logs student performance (Score, Verdict, Spoken Text, Target Text) to a Google Spreadsheet.
     - Patches the uploaded Google Drive URL link back into the correct row on the Google Sheet.

4. **`src/assets/js/stt.js` (Speech Engine Core)**
   - **Role:** The client-side wrapper around the Web Speech API (and the offline Whisper fallback).
   - **Interaction:** Injected into activity HTML files (like `pingpong.html`). Manages microphone permissions, handles chunking audio via `MediaRecorder` to save `webm` files, and dispatches transcription events (`onInterim`, `onFinal`) back to the game logic loops.

## 3. Critical Evaluation & UX Risks

### A. Google Sheets/Drive Integration (`Code.gs` & `server.js`)
- **Web App Redirects & Execution:** `Code.gs` requires deployment as a Web App to receive POST data. Because Google redirects POSTs to `usercontent.com` via HTTP 302, `server.js` contains custom logic in `postToAppsScript` to handle `https.get` following the redirect. This is a brittle mechanism that relies on the payload size. Base64 encoding audio files bloats the payload by ~33%. A long 5-minute recording could easily exceed Google Apps Script's payload size limits or Apps Script timeout limits (6 minutes), resulting in a silent failure or `HTTP 502/503` for the teacher.
- **Permissions Bottleneck:** `Code.gs` uploads files and executes `file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)`. If the teacher's Google Workspace admin policy disables sharing outside the organization, this line will crash the Apps Script, preventing the URL patch into the Sheet, and failing silently on the UI side.
- **Data Mutability/Concurrent Writes:** The script uses `LockService` for up to 10 seconds. In a classroom of 30 kids finishing a game simultaneously, requests might hit the timeout lock, rejecting submissions with "System busy."

### B. Speech Engine (`stt.js`)
- **Offline Fallback Risk:** `stt.js` defaults to a `whisper-cli.exe` call when offline. This locks the application strictly to Windows environments, making it incompatible on classroom Macs or Chromebooks unless an alternative binary is present.
- **Silence Timeout UX:** The silence monitor in `stt.js` has a timeout of 8000ms, which truncates to 2500ms or 1000ms if text is detected. For Year 1 ESL students, 2.5 seconds may not be enough time to sound out multi-syllable phonics, abruptly cutting them off and logging a poor score.

## 4. Edge Case Analysis

### A. Phonics Pong (`pingpong.html`)
- **Objective:** Fast-paced gamified phonetic recall. Players command paddles by saying words containing a specific target phoneme.
- **Phonetic Evaluation Logic:**
  The file implements fuzzy matching via a custom `levenshtein()` function against a list of pre-defined target words loaded from `localStorage` (`CUSTOM_POEM`). It also utilizes a `wordHasPhoneme(w, phoneme.label)` function (if defined globally, presumably in `utils.js`).
- **Edge Case - Phonemic Orthography Mismatches:**
  The speech-to-text API (whether Web Speech API or Whisper) transcribes audio into *English text*, not International Phonetic Alphabet (IPA).
  - If a student's target phoneme is the long A sound `/eɪ/`, and they say "weigh," the STT engine transcribes the text `"weigh"`.
  - The logic checks `phoneme.words.indexOf("weigh")`. If "weigh" was not explicitly listed in the teacher's lesson plan array for `/eɪ/`, the match relies entirely on the `wordHasPhoneme()` fallback.
  - If the student says "choir", aiming for a `/k/` sound, the engine transcribes `"choir"`. If the code simply looks for the letter "k" or relies on a basic grapheme-to-phoneme map, it will incorrectly mark it as wrong.
  - The implementation evaluates *graphemes* (text words) rather than acoustic *phonemes*. It completely fails to handle homophones (e.g., "read" /ri:d/ vs "read" /rɛd/) because the text transcript lacks phonetic context. The educational objective is acoustic, but the programmatic evaluation is strictly textual, representing a fundamental flaw in the edge-case handling for KSSR phonics.
