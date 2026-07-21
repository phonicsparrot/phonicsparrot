🎯 **What:**
Added unit tests for the `saveRecording` function in `src/assets/js/utils.js`. Because `saveRecording` handles multiple side-effects (Tauri core APIs, local server fetches, Google Drive fetches, and browser native download fallbacks), it was a critical failure point that lacked coverage.

📊 **Coverage:**
The new test suite covers:
- **Happy Path:** Success triggers for local API and Drive saves.
- **Tauri Integration:** Succeeds silently or falls back appropriately if Tauri core functions throw.
- **Network Failures:** Correctly falls back to browser-based object URL downloading if `fetch` rejects.
- **HTTP Errors:** Correctly falls back to browser-based downloading if `fetch` resolves with `res.ok = false`.
- **Global Error Boundary:** Catches and logs synchronous errors inside the main `try/catch` block.

✨ **Result:**
The test coverage now provides a reliable safety net for refactoring `saveRecording`. The Node native test runner handles testing legacy vanilla JS without module exports by utilizing `fs.readFileSync` combined with `jsdom` evaluation.
