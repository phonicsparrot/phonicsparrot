# Teacher Setup Guide

> **5-minute setup for classroom use**

---

## Step 1: Launch the App

### Option A — Browser (Recommended)
Double-click `START.bat` in the root folder. Chrome/Edge opens automatically.

### Option B — Terminal Command
Run `npm start` in the project root folder.

---

## Step 2: Allow Microphone Access

The first time you use any voice activity:
1. Click **"🎤 Start Listening"**
2. Browser asks: "Allow microphone?" → Click **Allow**
3. If blocked: Click the 🔒 icon in the address bar → Microphone → Allow

---

## Step 3: Create Your First Lesson

1. Click **👩‍🏫 Teacher Dashboard** on the homepage
2. Enter your name → Enter student's name → Click **✓ Set**
3. Paste a poem or song lyrics into the text area (one line per sentence)
4. Click **Process Text**
5. Click any word → Choose the phonics sound (phoneme) it contains
   - Example: "play" → click → choose `/eɪ/` from the popup
6. Click **💾 Save & Apply to All Activities**

> **Tip:** The app comes with a default "Free Time" poem pre-loaded. You can use it immediately.

---

## Step 4: Start an Activity

From the homepage, click any card:

| Card | Best For |
|------|---------|
| **Flashcard Builder** | Individual word practice — "Say this word" |
| **Poem Builder** | Fill-in-the-blank poem — "What's the missing word?" |
| **Line Reader** | Full-sentence pronunciation — "Read the whole line" |
| **Phonics Pong** | Two-player game — "Say your sound to block the ball!" |

---

## Step 5: Adjust for Your Classroom

### Font Size
Click the **Aa** button (bottom-right corner) to cycle:
- **A** — Small
- **Aa** — Medium (default)
- **AA** — Large
- **🏫** — Classroom Mode (projector-optimised, 72px+ text)

### Screen Size
The app fills any 16:9 screen automatically. Works on:
- Laptops (1366×768)
- Projectors (1920×1080)
- Interactive whiteboards

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start/stop microphone |
| `←` `→` | Navigate between cards/lines |
| `S` | Shuffle cards |
| `R` | Repeat (parrot speaks the word/line) |
| `Esc` | Stop all speech/mic |

---

## Google Sheets (Optional)

To track student performance:
1. Create a Google Sheet
2. Deploy it as a Web App: Extensions → Apps Script → Deploy → Web App
3. Copy the Web App URL
4. Paste it in the Teacher Dashboard's "Google Sheets Web App URL" field
5. Every student attempt is automatically logged

Data columns: `timestamp, student, teacher, activity, target_word, target_phoneme, spoken_word, accuracy_score, verdict`

---

## Voice Recordings

When the microphone is active, the app saves audio recordings. Files are named:
`<student>_<YYYY-MM-DD>_<activity>_<HH-MM-SS>.webm`

Saved to your browser's default download folder (or the `recordings/` folder in the app directory).

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| "No Active Lesson" | Go to Teacher Dashboard and save a lesson first |
| Mic not working | Check 🔒 icon → Allow microphone |
| Text too small | Click Aa button → 🏫 Classroom Mode |
| Whisper stuck | Switch back to Web Speech mode (default) |
| Blank page | Refresh the page (F5) |
