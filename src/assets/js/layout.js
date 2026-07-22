/**
 * layout.js — Phonics Parrot Layout Engine  v9.0
 *
 * Adaptive Fill-Mode Scaling:
 *  - Detects viewport dimensions and aspect ratio.
 *  - On 16:9 (±tolerance): fills exactly, same as v8.
 *  - On wider screens (21:9, 32:9): scales to fill height; extra width shows background.
 *  - On taller screens (4:3, 16:10): scales to fill width; extra height shows background.
 *  - Zero letterboxing. Zero scrollbars. Beautiful background fill everywhere.
 *  - Quality clamp: 0.5× minimum, 5.0× maximum (covers 8K displays).
 *  - Homepage uses native responsive CSS — no zoom, fills viewport.
 *  - Activity pages use adaptive zoom to fill any screen edge-to-edge.
 */

function PhonicsLayout(designWidth, designHeight) {
  this._designW = designWidth  || 1280;
  this._designH = designHeight || 720;
  this._timer   = null;
  this._lastScale = 0;
  this._init();
}

PhonicsLayout.prototype._init = function () {
  var self = this;
  var schedule = function () {
    clearTimeout(self._timer);
    self._timer = setTimeout(function () { self.apply(); }, 80);
  };
  window.addEventListener("resize", schedule);
  if (screen && screen.orientation) {
    screen.orientation.addEventListener("change", schedule);
  }
  window.addEventListener("orientationchange", function () {
    setTimeout(schedule, 200);
  });
  this.apply();
};

PhonicsLayout.prototype.apply = function () {
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var isPortrait = vh > vw;

  var rotateMsg = document.getElementById("rotate-msg");
  var root      = document.getElementById("scale-root");

  // Landscape lock (only active if rotate-msg element exists)
  if (isPortrait && rotateMsg) {
    rotateMsg.style.display = "flex";
    if (root) root.style.visibility = "hidden";
    return;
  }

  if (rotateMsg) rotateMsg.style.display = "none";
  if (root) root.style.visibility = "visible";
  document.body.style.overflow = "hidden";

  if (!root) return;

  // ── Adaptive scale calculation ──────────────────────────────────
  //
  // Design: 1280×720 (16:9, aspect 1.778)
  // Strategy: fill the LARGER dimension so the background gradient
  // handles any overscan beautifully — zero letterboxing.
  //
  var designAspect = this._designW / this._designH;
  var viewAspect   = vw / vh;
  var scale;

  if (viewAspect >= designAspect) {
    // Screen is WIDER than 16:9 (e.g. 21:9 ultrawide, 32:9)
    // → Scale to fill HEIGHT; extra width = beautiful background
    scale = vh / this._designH;
  } else {
    // Screen is TALLER than 16:9 (e.g. 4:3 projector, 16:10 laptop)
    // → Scale to fill WIDTH; extra height = beautiful background
    scale = vw / this._designW;
  }

  // Quality clamps:
  //   0.5× min = readable on tiny windows (640×360)
  //   5.0× max = sharp on 8K displays (6400×3600)
  scale = Math.min(Math.max(scale, 0.5), 5.0);

  // Apply zoom and let flexbox handle centering
  root.style.zoom       = scale;
  root.style.position   = "relative";
  root.style.width      = this._designW + "px";
  root.style.height     = this._designH + "px";
  root.style.top        = "auto";
  root.style.left       = "auto";
  root.style.marginTop  = "0";
  root.style.marginLeft = "0";
  root.style.transform  = "none";
  root.style.overflow   = "hidden";

  document.documentElement.style.setProperty("--app-zoom", scale);

  // Only fire event when scale actually changed (avoids thrashing)
  if (Math.abs(scale - this._lastScale) > 0.001) {
    this._lastScale = scale;
    window.dispatchEvent(new CustomEvent("phonics-scale", {
      detail: { scale: scale, designW: this._designW, designH: this._designH },
    }));
  }
};

/* ── Ambient Motes ──────────────────────────────────────────── */

function initMotes() {
  var container = document.getElementById("motes");
  if (!container) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var frag = document.createDocumentFragment();
  for (var i = 0; i < 40; i++) {
    var mote = document.createElement("div");
    mote.className = "mote";
    mote.style.left              = Math.random() * 100 + "%";
    mote.style.top               = Math.random() * 100 + "%";
    var size = (Math.random() * 0.12 + 0.08) + "rem";
    mote.style.width             = size;
    mote.style.height            = size;
    mote.style.animationDuration = (Math.random() * 18 + 14) + "s";
    mote.style.animationDelay    = "-" + (Math.random() * 20) + "s";
    frag.appendChild(mote);
  }
  container.appendChild(frag);
}

/* ── TTS Wrapper (Bluetooth-safe) ───────────────────────────── */

function safeSpeak(text, opts) {
  if (!window.speechSynthesis) {
    if (opts && opts.onend) setTimeout(function () { opts.onend(); }, 0);
    return;
  }
  opts = opts || {};
  try { window.speechSynthesis.cancel(); } catch (_) {}
  try { window.speechSynthesis.resume(); } catch (_) {}
  setTimeout(function () {
    try {
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang  = opts.lang  || "en-GB";
      utterance.pitch = opts.pitch !== undefined ? opts.pitch : 1;
      utterance.rate  = opts.rate  !== undefined ? opts.rate  : 1;
      if (opts.voice) utterance.voice = opts.voice;
      var finished = false;
      var cleanup = function () {
        if (finished) return;
        finished = true;
        if (opts.onend) opts.onend();
      };
      if (opts.onstart) utterance.onstart = opts.onstart;
      utterance.onend   = cleanup;
      utterance.onerror = function (e) {
        cleanup();
        if (e.error && e.error !== "interrupted" && opts.onerror) opts.onerror(e);
      };
      window.speechSynthesis.speak(utterance);
      var resumeId = setInterval(function () {
        if (finished) { clearInterval(resumeId); return; }
        if (window.speechSynthesis.paused) {
          try { window.speechSynthesis.resume(); } catch (_) {}
        }
      }, 5000);
    } catch (e) {
      if (opts.onend) setTimeout(function () { opts.onend(); }, 100);
    }
  }, 50);
}

/* ── Font Size Toggle (Classroom-Optimised) ────────────────── */
/*
 * Research-backed sizes for 65″ 1080p classroom screen at 30′:
 *   Extron formula: 1″ text height per 15′ → need 2″ min, 3″ comfortable
 *   At 1280×720 design (1.5× zoom to 1080p): 68px = 3″ physical
 *   Children Year 1-2 (6-8 yrs): 1.5× adult minimum
 *   Default = "large" (classroom-ready from first launch)
 */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    initMotes();

    var sizes       = ["medium", "large", "classroom", "xclassroom"];
    var sizeToRem   = { medium: "1rem", large: "1.35rem", classroom: "1.7rem", xclassroom: "2.2rem" };
    var fontScales  = { medium: 1, large: 1.5, classroom: 2.0, xclassroom: 2.8 };
    var sizeLabels  = { medium: "A", large: "Aa", classroom: "🏫", xclassroom: "🏫+" };
    var current     = localStorage.getItem("PP_FONT_SIZE") || "large";

    if (sizeToRem[current] === undefined) current = "large";

    document.documentElement.style.fontSize = sizeToRem[current];
    document.documentElement.style.setProperty("--font-scale", fontScales[current]);
    if (current === "classroom" || current === "xclassroom") document.body.classList.add("classroom-mode");

    var btn = document.createElement("button");
    btn.id = "fontSizeToggle";
    btn.textContent = sizeLabels[current];
    btn.title = "Font: " + current + (current.indexOf("classroom")>=0 ? " (projector)" : "");
    btn.setAttribute("aria-label", "Font size: " + current);
    btn.style.cssText =
      "position:fixed;bottom:0.8rem;right:0.8rem;z-index:9998;" +
      "font-size:0.9rem;padding:0.45rem 0.8rem;background:#fff;" +
      "color:#1e293b;border:2.5px solid #1e293b;" +
      "border-radius:10px;cursor:pointer;font-family:'Fredoka',sans-serif;" +
      "box-shadow:0 3px 0 #1e293b;font-weight:800;transition:all 0.1s;";


    btn.onclick = function () {
      var idx = sizes.indexOf(current);
      idx = (idx + 1) % sizes.length;
      current = sizes[idx];
      document.documentElement.style.fontSize = sizeToRem[current];
      document.documentElement.style.setProperty("--font-scale", fontScales[current]);
      localStorage.setItem("PP_FONT_SIZE", current);
      btn.textContent = sizeLabels[current];
      btn.title = "Font: " + current + (current.indexOf("classroom")>=0 ? " (projector)" : "");
      document.body.classList.toggle("classroom-mode", current === "classroom" || current === "xclassroom");
      window.dispatchEvent(new CustomEvent("phonics-font-scale", {
        detail: { size: current, scale: fontScales[current] }
      }));
    };
    document.body.appendChild(btn);
  });
})();

/* ── PWA Service Worker (browser-only, no-op in Tauri) ──────── */

(function () {
  // Skip in Tauri/WebView — not supported, produces silent errors
  if (typeof window.__TAURI__ !== "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  var base = window.location.pathname;
  var swPath;
  if (base.indexOf("/activities/") !== -1) {
    swPath = base.replace(/\/activities\/.*$/, "/sw.js");
  } else {
    swPath = base.replace(/\/[^/]*$/, "/sw.js");
  }
  navigator.serviceWorker.register(swPath).catch(function (err) {
    // Ignore in dev — SW only works on HTTPS/production
  });
})();

/* ── INTERACTIVE DEBUG FEEDBACK SYSTEM ───────────────────────── */
(function initDebugFeedback() {
  document.addEventListener("DOMContentLoaded", function () {
    var configUrl = "/api/config";
    if (window.location.pathname.indexOf("activities/") !== -1) {
      configUrl = "../api/config";
    }
    fetch(configUrl)
      .then(function (res) { return res.json(); })
      .then(function (cfg) {
        if (cfg && cfg.debugModeAllowed) {
          runDebugSetup();
        }
      })
      .catch(function () {});
  });

  function runDebugSetup() {
    var isDebugUrl = window.location.search.indexOf("debug=true") !== -1;
    var isDebugStorage = localStorage.getItem("PP_DEBUG") === "true";
    if (!isDebugUrl && !isDebugStorage) return;

    // 1. Inject styles
    var css = "\
      .debug-toggle-btn {\
        position: fixed; bottom: 0.8rem; left: 0.8rem; z-index: 99999;\
        font-size: 0.9rem; padding: 0.45rem 0.8rem; background: #ffebee;\
        color: #e94560; border: 2.5px solid #1e293b;\
        border-radius: 10px; cursor: pointer; font-family: 'Fredoka', sans-serif;\
        box-shadow: 0 3px 0 #1e293b; font-weight: 800; transition: all 0.1s;\
      }\
      .debug-toggle-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #1e293b; }\
      .debug-toggle-btn.active { background: #e8f5e9; color: #2e7d32; }\
      \
      .debug-banner {\
        position: fixed; top: 0; left: 50%; transform: translateX(-50%);\
        background: #ef5350; color: #fff; padding: 0.35rem 1.2rem;\
        font-family: 'Fredoka', sans-serif; font-size: 0.8rem; font-weight: 700;\
        border: 2px solid #1e293b; border-top: none; border-radius: 0 0 10px 10px;\
        z-index: 100000; box-shadow: 0 3px 0 #1e293b; pointer-events: none;\
        letter-spacing: 1px; display: none;\
      }\
      .debug-banner.active { display: block; }\
      \
      .debug-pin {\
        position: absolute; width: 28px; height: 28px;\
        background: #e94560; border: 2.5px solid #1e293b; border-radius: 50%;\
        box-shadow: 0 4px 0 #1e293b, 0 0 10px rgba(233, 69, 96, 0.6);\
        display: flex; align-items: center; justify-content: center;\
        font-size: 15px; z-index: 99998;\
        cursor: pointer; transform: translate(-50%, -50%);\
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);\
      }\
      .debug-pin:hover { transform: translate(-50%, -50%) scale(1.25); z-index: 99999; }\
      \
      .debug-pin-tooltip {\
        position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%);\
        background: #1e293b; color: #fff; padding: 0.6rem 0.9rem;\
        border-radius: 12px; font-size: 0.85rem; font-family: 'Fredoka', sans-serif;\
        box-shadow: 0 8px 16px rgba(0,0,0,0.15); width: 220px;\
        text-align: center; pointer-events: none; display: none;\
        z-index: 100000; line-height: 1.4;\
      }\
      .debug-pin:hover .debug-pin-tooltip { display: block; }\
      .debug-pin-tooltip::after {\
        content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);\
        border: 6px solid transparent; border-top-color: #1e293b;\
      }\
      \
      .debug-comment-modal {\
        position: fixed; inset: 0; z-index: 100001;\
        background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(4px);\
        display: flex; align-items: center; justify-content: center;\
        opacity: 0; visibility: hidden; transition: all 0.2s;\
      }\
      .debug-comment-modal.show { opacity: 1; visibility: visible; }\
      \
      .debug-comment-card {\
        background: #fff; border: 4px solid #1e293b; border-radius: 20px;\
        padding: 1.5rem; width: 90%; max-width: 400px;\
        box-shadow: 0 8px 0 #1e293b, 0 20px 40px rgba(0,0,0,0.15);\
        color: #1e293b; font-family: 'Fredoka', sans-serif;\
        transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.25);\
      }\
      .debug-comment-modal.show .debug-comment-card { transform: scale(1); }\
      \
      .debug-comment-title { font-size: 1.2rem; font-weight: 800; margin-bottom: 0.8rem; color: #ff7b00; }\
      .debug-comment-coords { font-size: 0.8rem; color: #64748b; font-weight: 700; margin-bottom: 0.8rem; }\
      \
      .debug-comment-textarea {\
        width: 100%; height: 100px; background: #f8fafc; border: 2.5px solid #1e293b;\
        border-radius: 12px; padding: 0.6rem 0.8rem; font-family: inherit; font-size: 0.95rem;\
        color: #1e293b; resize: none; outline: none; margin-bottom: 1rem;\
      }\
      .debug-comment-textarea:focus { border-color: #ff7b00; }\
      \
      .debug-comment-actions { display: flex; gap: 0.6rem; }\
      .debug-comment-btn {\
        flex: 1; padding: 0.6rem 1rem; border-radius: 12px; border: 2.5px solid #1e293b;\
        font-family: inherit; font-weight: 800; cursor: pointer; transition: all 0.1s;\
        box-shadow: 0 3px 0 #1e293b; font-size: 0.95rem; text-align: center;\
      }\
      .debug-comment-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #1e293b; }\
      .debug-comment-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #1e293b; }\
      .debug-comment-btn.save { background: #2ec4b6; color: #fff; }\
      .debug-comment-btn.cancel { background: #ffebee; color: #e94560; }\
    ";
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    // 2. Add Floating Toggle Button
    var toggleBtn = document.createElement("button");
    toggleBtn.className = "debug-toggle-btn";
    toggleBtn.innerHTML = "🐞 Debug Mode: OFF";
    document.body.appendChild(toggleBtn);

    // 3. Add Banner Overlay
    var banner = document.createElement("div");
    banner.className = "debug-banner";
    banner.textContent = "🐞 DEBUG ACTIVE — RIGHT-CLICK ANYWHERE TO COMMENT";
    document.body.appendChild(banner);

    // 4. Add Comment Modal Markup
    var modal = document.createElement("div");
    modal.className = "debug-comment-modal";
    modal.innerHTML = '\
      <div class="debug-comment-card">\
        <div class="debug-comment-title">🐞 Add Feedback Comment</div>\
        <div class="debug-comment-coords" id="debug-coords-label">X: 0, Y: 0</div>\
        <textarea class="debug-comment-textarea" id="debug-comment-text" placeholder="Explain what to edit or fix here..."></textarea>\
        <div class="debug-comment-actions">\
          <button class="debug-comment-btn cancel" id="debug-cancel-btn">Cancel</button>\
          <button class="debug-comment-btn save" id="debug-save-btn">Save Comment</button>\
        </div>\
      </div>\
    ';
    document.body.appendChild(modal);

    var cancelBtn = document.getElementById("debug-cancel-btn");
    var saveBtn = document.getElementById("debug-save-btn");
    var textInput = document.getElementById("debug-comment-text");
    var coordsLabel = document.getElementById("debug-coords-label");

    // Prevent typing from bubbling up to activate global page shortcuts (e.g. Space to Record)
    textInput.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.code === "Escape") {
        modal.classList.remove("show");
        activeCoords = null;
      }
    });
    textInput.addEventListener("keyup", function (e) {
      e.stopPropagation();
    });
    textInput.addEventListener("keypress", function (e) {
      e.stopPropagation();
    });

    var activeCoords = null;
    var debugActive = sessionStorage.getItem("debug_feedback_active") === "true";

    function updateState() {
      toggleBtn.classList.toggle("active", debugActive);
      toggleBtn.innerHTML = debugActive ? "🐞 Debug Mode: ON" : "🐞 Debug Mode: OFF";
      banner.classList.toggle("active", debugActive);
      sessionStorage.setItem("debug_feedback_active", debugActive);
      
      if (debugActive) {
        loadPins();
      } else {
        clearPins();
      }
    }

    toggleBtn.onclick = function (e) {
      e.stopPropagation();
      debugActive = !debugActive;
      updateState();
    };

    document.addEventListener("contextmenu", function (e) {
      if (!debugActive) return;
      e.preventDefault();

      var scaleRoot = document.getElementById("scale-root");
      var x, y;
      if (scaleRoot) {
        var rect = scaleRoot.getBoundingClientRect();
        var zoom = parseFloat(document.documentElement.style.getPropertyValue("--app-zoom")) || 1;
        x = Math.round((e.clientX - rect.left) / zoom);
        y = Math.round((e.clientY - rect.top) / zoom);
      } else {
        x = Math.round(e.pageX);
        y = Math.round(e.pageY);
      }

      activeCoords = { x: x, y: y };
      
      coordsLabel.textContent = "Location: X=" + x + "px, Y=" + y + "px (Page: " + getPageName() + ")";
      textInput.value = "";
      modal.classList.add("show");
      textInput.focus();
    });

    cancelBtn.onclick = function () {
      modal.classList.remove("show");
      activeCoords = null;
    };

    saveBtn.onclick = function () {
      var text = textInput.value.trim();
      if (!text || !activeCoords) return;

      var commentData = {
        page: getPageName(),
        x: activeCoords.x,
        y: activeCoords.y,
        comment: text,
        timestamp: new Date().toISOString()
      };

      var saveUrl = "/api/save-comment";
      // Handle activity pages sub-directory
      if (getPageName().indexOf("activities/") !== -1) {
        saveUrl = "../api/save-comment";
      }

      fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commentData)
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          modal.classList.remove("show");
          activeCoords = null;
          loadPins();
        }
      })
      .catch(function (err) {
        alert("Failed to save comment: " + err.message);
      });
    };

    function getPageName() {
      var path = window.location.pathname;
      var parts = path.split("/");
      var file = parts[parts.length - 1] || "index.html";
      if (path.indexOf("/activities/") !== -1) {
        return "activities/" + file;
      }
      return file;
    }

    function clearPins() {
      var pins = document.querySelectorAll(".debug-pin");
      for (var i = 0; i < pins.length; i++) {
        pins[i].parentNode.removeChild(pins[i]);
      }
    }

    function loadPins() {
      clearPins();
      var scaleRoot = document.getElementById("scale-root");
      var parent = scaleRoot || document.body;
      if (!parent) return;

      var fetchUrl = "/debug_comments.json";
      if (getPageName().indexOf("activities/") !== -1) {
        fetchUrl = "../debug_comments.json";
      }

      fetch(fetchUrl + "?t=" + Date.now())
        .then(function (res) { return res.json(); })
        .then(function (comments) {
          if (!Array.isArray(comments)) return;
          var currentPage = getPageName();
          var count = 1;
          for (var i = 0; i < comments.length; i++) {
            var c = comments[i];
            if (c.page === currentPage) {
              createPin(parent, c, count++);
            }
          }
        })
        .catch(function (_) {});
    }

    function createPin(parent, commentObj, index) {
      var pin = document.createElement("div");
      pin.className = "debug-pin";
      pin.style.left = commentObj.x + "px";
      pin.style.top = commentObj.y + "px";
      pin.innerHTML = "📍";

      var tooltip = document.createElement("div");
      tooltip.className = "debug-pin-tooltip";
      tooltip.innerHTML = "<strong>Comment #" + index + "</strong><br>" + escapeHTML(commentObj.comment);
      pin.appendChild(tooltip);

      parent.appendChild(pin);
    }

    function escapeHTML(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Force SVG animations to reload on DOM load (fixes Chrome SVG caching freeze bug)
    (function () {
      var images = document.querySelectorAll("img");
      var buster = "?cb=" + Date.now();
      for (var i = 0; i < images.length; i++) {
        var src = images[i].getAttribute("src");
        if (src && (src.indexOf("poster.svg") !== -1 || src.indexOf("plant_decor.svg") !== -1)) {
          images[i].setAttribute("src", src.split("?")[0] + buster);
        }
      }
    })();

    updateState();
  }
})();
