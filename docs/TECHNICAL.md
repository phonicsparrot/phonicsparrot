# Technical Documentation

> **Architecture, data flow, build pipeline, and development guide**

---

## Architecture

```
┌──────────────────────────────────────────────┐
│              Phonics Parrot                  │
│                                              │
│         ┌─────────────────┐                  │
│         │   src/ (HTML/   │                  │
│         │   CSS/JS)       │                  │
│         └────────┬────────┘                  │
│                  │                           │
│     ┌────────────┼────────────┐              │
│     ▼            ▼            ▼              │
│  Web Speech   Whisper AI   SpeechSynth       │
│  API (STT)    (opt-in)     (TTS)             │
└──────────────────────────────────────────────┘
```

### Scaling Engine

`layout.js` implements zoom-based viewport fitting:
- Activity pages: CSS `zoom` on `#scale-root` fills the screen
- Homepage: native responsive CSS within `100vh` constraint
- Design dimensions: **1280×720** (true 16:9)
- Zero scrollbars — overflow hidden everywhere

### Data Flow

```
Teacher Dashboard → localStorage["CUSTOM_POEM"] → All Activities
                                                      │
Student speaks → mic → PhonicsSTT → Web Speech API
                         │
                         └→ MediaRecorder (parallel audio capture)
                              │
                              └→ saveRecording() → .webm file
```

---

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.html` | ~230 | Hub page, 4 cards, dynamic phoneme chips |
| `src/activities/builder.html` | ~620 | Flashcard Builder: word + mic + result |
| `src/activities/speak.html` | ~920 | Poem Builder: multi-stanza, fill-in-blank, review |
| `src/activities/reader.html` | ~520 | Line Reader: full-line pronunciation scoring |
| `src/activities/pingpong.html` | ~630 | Phonics Pong: 2-player voice-controlled game |
| `src/activities/teacher.html` | ~560 | Teacher Dashboard: poem tagger, login, sheets |
| `src/assets/js/utils.js` | ~400 | Shared utilities: censor, levenshtein, grapheme map, logging |
| `src/assets/js/stt.js` | ~380 | PhonicsSTT: dual-mode speech recognition engine |
| `src/assets/js/layout.js` | ~250 | PhonicsLayout: zoom scaling, motes, safeSpeak, font toggle |
| `src/assets/css/shared.css` | ~200 | Global styles, orbs, motes, setup screen |

---

## localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `CUSTOM_POEM` | JSON array | Teacher's tagged poem data (source of truth) |
| `PP_FONT_SIZE` | string | Font size: "small" / "medium" / "large" / "classroom" |
| `PP_POEM_PROGRESS` | JSON | Poem Builder resume data |
| `PP_PERFORMANCE_LOG` | JSON array | Last 500 performance entries |
| `PP_GSHEET_URL` | string | Google Sheets Web App URL (optional) |

## sessionStorage Keys

| Key | Purpose |
|-----|---------|
| `PP_TEACHER_NAME` | Current teacher name |
| `PP_STUDENT_NAME` | Current student name |
| `pp_launched` | First-launch redirect flag |

---

## STT Engine

`stt.js` implements a state machine:

```
IDLE → start() → LISTENING → onFinal → PROCESSING → onStatus("stopped")
                    │                                        │
                    └── silence (8s) → stop("silence") ──────┘
```

- Creates fresh `SpeechRecognition` per session
- Exponential backoff retry (300ms→600ms→1200ms, 3 max)
- Silence monitor at 8 seconds
- Parallel `MediaRecorder` for audio capture (when enabled)
- `stop(reason)` passes reason to activity's `onStatus` handler

---

## Grapheme Mapping

`wordHasPhoneme()` in `utils.js` maps IPA phonemes to common English spelling patterns:

| Phoneme | Graphemes |
|---------|-----------|
| /eɪ/ | ay, ai, a_e, ea, eigh, ey |
| /aɪ/ | igh, ie, i_e, y, ye |
| /iː/ | ee, ea, ie, e_e, y |
| /ɔɪ/ | oi, oy |

This allows Phonics Pong to detect words like "day" for /eɪ/ even if "day" wasn't in the teacher's imported poem.

---

## Development Server

Start the Node.js server to serve the frontend:
```bash
npm start
```
Or:
```bash
node server.js    # Serves src/ on :3000
```

---

## CSP & Security

`tauri.conf.json` enforces:
```
default-src 'self'; script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
connect-src 'self'; media-src 'self' blob:;
worker-src 'self' blob:; font-src 'self' data:
```

COOP/COEP headers enabled for SharedArrayBuffer (Whisper AI support).

---

## Known Limitations

- Google Sheets requires a deployed Web App URL (teacher must configure)
- TTS voice quality depends on OS-installed voices

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| v6 | Jul 2026 | Zoom-based scaling, dual-mode STT, security audit |
| v7 | Jul 2026 | 9 bug fixes, grapheme detection, Google Sheets, recordings, auto-keying |
| v8 | Jul 2026 | 16:9 zero-scrollbar, project reorganisation, browser edition, documentation |
