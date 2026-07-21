# Phonics Parrot v7 Changelog

All notable changes in version 7 are detailed below.

## [7.0.0] - 2026-07-13

### Added
- **Classroom Login Session:** Dashboard panel for Teacher name and Student name, persisting to `sessionStorage` and syncing across all activities.
- **Google Sheets API v4 Integration:** Serverless direct appending of student performance logs using Service Account JWT authentication (via native Web Crypto API).
- **Silent Voice Recording:** Background recording of student voices alongside STT verification, saved directly on the local filesystem as `.webm` files.
- **Extended Phonics Pong Vocabulary:** Heuristic-based regex matching for curriculum sounds, letting students solidify their paddles using any valid word matching the phoneme.
- **Global Error Boundary:** Fallback overlay catching uncaught errors and offering a "Reset App Data" option to solve configuration corruption.

### Fixed
- **Homepage Layout:** Overflow scrollbars and grid margins converted to `rem` to prevent cut-off.
- **Icon Disappearance:** Moved CSS shadow filters to parent containers, fixing SVG WebView2 rendering.
- **Classroom Mode Sizing:** Line text size scaled to 72px (4.5rem) minimum with scrollable stanza cards.
- **Silence Monitor Crash:** Suspended silence monitors during continuous STT loops.
- **STT InvalidStateError:** Delayed recognition start routines if clean shutdown is pending.
