# Phonics Parrot — Digital Learning Suite

> **KSSR Year 1–2 Language Arts** | IPGKSAH Innovation Project  
> **Version:** 0.2.0 | **Design:** 16:9 (1280×720) | **Zero Scrollbars**

---

## What Is Phonics Parrot?

A voice-interactive web application for phonics education. Students speak into a microphone and the "parrot" gives real-time feedback on their pronunciation. Built for primary school classrooms.

**Four Activities:**
| Activity | What It Does |
|----------|-------------|
| 🔤 **Flashcard Builder** | Single-word pronunciation practice with IPA phoneme badges |
| ✏️ **Poem Builder** | Fill-in-the-blank poem construction with STT verification |
| 📖 **Line Reader** | Full-line reading with per-word accuracy scoring |
| 🏓 **Phonics Pong** | Two-player voice-controlled Pong game |

---

## Quick Start

### Browser Edition
Ensure you have Node.js installed, then start the server:

```bash
npm start
```
Or simply double-click `START.bat` in the project root folder. The app will automatically launch in Chrome/Edge at:
`http://localhost:3000`

*Note: Microphone permission is required on first use.*

---

## Project Structure

```
phonics-parrot/
├── src/                    # Frontend source files (HTML/CSS/JS)
│   ├── index.html          # Hub page with 4 activity cards
│   ├── activities/         # 5 activity HTML files
│   └── assets/             # Styling, layouts, and STT integrations
├── docs/                   # Documentation and integration guides
│   ├── TEACHER_SETUP.md    # Guide for setting up activities
│   ├── TECHNICAL.md        # Technical specs
│   └── GOOGLE_SHEETS.md    # Google Sheets Apps Script guide
├── recordings/             # Saved audio recordings (organized by student name)
├── server.js               # Standalone dev server script
├── START.bat               # Dev launcher script
└── package.json            # Node.js configurations
```

---

## Key Features

| Feature | Description |
|---------|------------|
| **16:9 Zero-Scroll** | Every page fills the screen exactly — no scrollbars ever |
| **Classroom Mode** | 🏫 toggle → 72px+ text for projector visibility |
| **Dynamic Phonemes** | Homepage chips auto-populate from teacher's lesson data |
| **Grapheme Detection** | Phonics Pong detects phoneme-containing words beyond tagged list |
| **Google Sheets** | Optional performance data logging to Google Sheets (CORS-safe) |
| **Voice Recording** | Parallel audio recording saved to organized folders |
| **Teacher Login** | Name-based session tracking across activities |
