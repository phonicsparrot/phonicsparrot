# Phonics Parrot v7 Audited Bugs & Fixes

This document records the results of the code audit for version 6, detail of root causes, and the fixes applied to version 7.

## 1. Homepage Layout Cut-off on Low Resolutions
* **Bug description:** On small screens/projectors, the bottom navigation/teacher buttons are cut off, and no scrollbars appear.
* **Root cause:** `PhonicsLayout.apply()` disables scrollbars on body/root (`overflow: hidden`) and skips scaling/margins on the homepage.
* **Fix applied (Option A):** Modified `layout.js` to set `root.style.overflowY = "auto"` and `document.body.style.overflow = "auto"` on the homepage. Added `rem` grid layouts to scale grid container correctly.

## 2. WebView SVG Rendering Glitch (Tauri Windows)
* **Bug description:** Card icons disappear completely inside the Tauri WebView.
* **Root cause:** WebView2 driver/acceleration bug when applying `filter: drop-shadow(...)` directly to inline SVG elements.
* **Fix applied (Option A):** Moved the CSS filter rule from the SVG tag to the container parent div `.card-icon` in `index.html`.

## 3. Dynamic Curriculum Phoneme Chips
* **Bug description:** Homepage chips are hardcoded to `/aɪ/ /eɪ/ /iː/ /ɔɪ/` and do not match lessons configured by the teacher.
* **Root cause:** There was no connection between `localStorage` custom poem sounds and the homepage tag rendering.
* **Fix applied (Option A):** Added dynamic loading to `index.html` inline script via `loadLessonData()` in `utils.js`. Chips are rendered dynamically and color-coded.

## 4. Classroom Mode Font Sizes & Container Overflow
* **Bug description:** Stanza card contents overflow out of bounds or overlap in classroom mode.
* **Root cause:** The card height is constrained via grid and `overflow: hidden`, and the lines lack responsive text scaling.
* **Fix applied (Option A):** Added `.classroom-mode` CSS overrides to `speak.html` specifying `font-size: 4.5rem !important` (72px) on lines, and enabled vertical scrollbars `overflow-y: auto !important` on `.stanza-card`.

## 5. Phonics Pong Hands-free Extended Word Detection
* **Bug description:** Paddles only activate for words explicitly typed into the dashboard, restricting vocal play.
* **Root cause:** Paddle activation uses simple index matching against a limited target array.
* **Fix applied (Option B):** Implemented regex G2P rules inside `utils.js` `wordHasPhoneme()`. Phonics Pong invokes this helper so any spoken word containing the active phoneme (e.g. "day" for `/eɪ/`) activates the paddle.

## 6. STT Silence Timeout Crash in Continuous Mode
* **Bug description:** Phonics Pong voice activation crashes after a brief pause of silence.
* **Root cause:** Silence monitor triggers `stop()` which aborts active SpeechRecognition, but Pong runs in `continuous` mode which needs always-on recognition.
* **Fix applied (Option A):** Modified `_startSilenceMonitor()` in `stt.js` to return immediately (`if (this.continuous) return;`) if continuous mode is enabled.
