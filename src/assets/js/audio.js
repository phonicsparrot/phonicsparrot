/**
 * audio.js — Phonics Parrot Unified Sound Controller
 * Manages sound effects (click, hover, success, fail, start) and BGM (theme).
 * Persists mute state via localStorage.
 */

(function () {
  const currentPath = window.location.pathname;
  let audioBase = "assets/audio/";
  if (currentPath.indexOf("activities/") !== -1) {
    audioBase = "../assets/audio/";
  }

  // Persistent mute state (defaults to unmuted, i.e., false)
  let isMuted = localStorage.getItem("PP_AUDIO_MUTED") === "true";

  let bgmInstance = null;
  let interactionInitialized = false;

  // Heuristics for where BGM should play automatically
  const isTeacherPage = currentPath.indexOf("teacher") !== -1 || currentPath.indexOf("guide") !== -1;

  function getBgm() {
    if (!bgmInstance) {
      bgmInstance = new Audio(audioBase + "theme.mp3");
      bgmInstance.loop = true;
      bgmInstance.volume = 0.15; // Subtle volume
      
      // Restore playback position from localStorage
      const savedTime = localStorage.getItem("PP_BGM_TIME");
      if (savedTime) {
        bgmInstance.currentTime = parseFloat(savedTime);
      }
      
      // Keep updating localStorage with current playback time
      bgmInstance.addEventListener("timeupdate", function () {
        if (!bgmInstance.paused) {
          localStorage.setItem("PP_BGM_TIME", bgmInstance.currentTime);
        }
      });
    }
    return bgmInstance;
  }

  const PhonicsAudio = {
    isMuted: function () {
      return isMuted;
    },

    toggleMute: function () {
      isMuted = !isMuted;
      localStorage.setItem("PP_AUDIO_MUTED", isMuted ? "true" : "false");
      
      const btn = document.getElementById("global-sound-btn");
      if (btn) {
        btn.textContent = isMuted ? "🔇" : "🔊";
      }

      if (isMuted) {
        if (bgmInstance) bgmInstance.pause();
      } else {
        if (!isTeacherPage) {
          const music = getBgm();
          music.play().catch(function (e) /* eslint-disable-line no-unused-vars */ {
            console.log("BGM play failed on unmute:", e.message);
          });
        }
        this.playClick();
      }
    },

    playSound: function (filename, volume) {
      if (isMuted) return;
      try {
        const snd = new Audio(audioBase + filename);
        snd.volume = volume || 0.4;
        snd.play().catch(function (e) /* eslint-disable-line no-unused-vars */ {
          // Playback blocked by browser policy
        });
      } catch (e) /* eslint-disable-line no-unused-vars */ {
        console.error("Failed to play sound: " + filename, e);
      }
    },

    playClick: function () {
      this.playSound("click.mp3", 0.45);
    },

    playHover: function () {
      this.playSound("hover.wav", 0.25);
    },

    playSuccess: function () {
      this.playSound("success.wav", 0.5);
    },

    playFail: function () {
      this.playSound("fail.mp3", 0.45);
    },

    playStart: function () {
      this.playSound("start.mp3", 0.5);
    },

    pauseBgm: function () {
      if (bgmInstance && !bgmInstance.paused) {
        bgmInstance.pause();
      }
    },

    resumeBgm: function () {
      if (isMuted || isTeacherPage) return;
      const music = getBgm();
      music.play().catch(function (e) /* eslint-disable-line no-unused-vars */ {
        // Ignored
      });
    }
  };

  // Autoplay bypass guesture listeners
  function initInteraction() {
    if (interactionInitialized) return;
    interactionInitialized = true;
    
    if (!isMuted && !isTeacherPage) {
      const music = getBgm();
      music.play().catch(function (e) /* eslint-disable-line no-unused-vars */ {
        // Failed, reset so we try again on next interaction
        interactionInitialized = false;
      });
    }

    window.removeEventListener("click", initInteraction);
    window.removeEventListener("touchstart", initInteraction);
    window.removeEventListener("keydown", initInteraction);
  }

  // Try to play BGM automatically on load if allowed
  if (!isMuted && !isTeacherPage) {
    try {
      const music = getBgm();
      music.play().then(function () {
        interactionInitialized = true;
      }).catch(function (e) /* eslint-disable-line no-unused-vars */ {
        // Blocked by browser autoplay policy
      });
    } catch (e) /* eslint-disable-line no-unused-vars */ { /* ignore */ }
  }

  // Export to window
  window.PhonicsAudio = PhonicsAudio;

  // Initialize UI and listeners on DOMContentLoaded
  function init() {
    // Add floating mute button
    let btn = document.getElementById("global-sound-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "global-sound-btn";
      btn.className = "sound-btn";
      btn.setAttribute("aria-label", "Toggle Sound");

      // Append to scale-root if exists, otherwise body
      const root = document.getElementById("scale-root");
      if (root) {
        root.appendChild(btn);
      } else {
        document.body.appendChild(btn);
      }
    }

    // Always sync text content and click listener
    btn.textContent = isMuted ? "🔇" : "🔊";
    btn.onclick = function (e) /* eslint-disable-line no-unused-vars */ {
      e.preventDefault();
      e.stopPropagation();
      PhonicsAudio.toggleMute();
    };

    // Save BGM time right before unload
    window.addEventListener("beforeunload", function () {
      if (bgmInstance) {
        localStorage.setItem("PP_BGM_TIME", bgmInstance.currentTime);
      }
    });

    // Set up autoplay gesture listeners
    window.addEventListener("click", initInteraction);
    window.addEventListener("touchstart", initInteraction);
    window.addEventListener("keydown", initInteraction);

    // Event delegation for general UI clicks and hovers
    document.addEventListener("click", function (e) /* eslint-disable-line no-unused-vars */ {
      // Don't play click sound on the sound toggle itself
      if (e.target.closest("#global-sound-btn")) return;

      const trigger = e.target.closest("a, button, .card, .btn, .enable-btn, .nav-btn, .again-btn, .exit-btn");
      if (trigger) {
        PhonicsAudio.playClick();
      }
    });

    document.addEventListener("mouseover", function (e) /* eslint-disable-line no-unused-vars */ {
      const trigger = e.target.closest("a.card, .enable-btn, .again-btn");
      if (trigger && !trigger.dataset.hoverSoundPlayed) {
        trigger.dataset.hoverSoundPlayed = "true";
        PhonicsAudio.playHover();
      }
    });

    document.addEventListener("mouseout", function (e) /* eslint-disable-line no-unused-vars */ {
      const trigger = e.target.closest("a.card, .enable-btn, .again-btn");
      if (trigger) {
        delete trigger.dataset.hoverSoundPlayed;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
