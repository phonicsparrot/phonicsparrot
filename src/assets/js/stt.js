/**
 * stt.js — Phonics Parrot Speech-to-Text Engine  v3.1
 */

var PhonicsSTT = (function () {
  "use strict";

  var MAX_RETRIES       = 3;
  var SILENCE_TIMEOUT_MS = 8000;
  var RESTART_DELAY_MS  = 150;

  var ERROR_MAP = {
    "not-allowed":            { type: "perm",    message: "Microphone blocked — check browser permissions." },
    "no-speech":              { type: "silence", message: "No speech detected — speak louder!" },
    "audio-capture":          { type: "device",  message: "Microphone disconnected or busy." },
    "network":                { type: "network", message: "Network error — check your connection." },
    "aborted":                { type: "aborted", message: "" },
    "service-not-allowed":    { type: "perm",    message: "Speech recognition not allowed on this page." },
    "bad-grammar":            { type: "config",  message: "Speech recognition configuration error." },
    "language-not-supported": { type: "config",  message: "Selected language is not supported." },
  };

  function classifyError(errorName) {
    return ERROR_MAP[errorName] || { type: "unknown", message: "Speech error: " + errorName };
  }

  function PhonicsSTT(options) {
    options = options || {};
    this.onInterim = options.onInterim || function () {};
    this.onFinal   = options.onFinal   || function () {};
    this.onStatus  = options.onStatus  || function () {};
    this.onError   = options.onError   || function () {};

    this._recordAudio = options.recordAudio !== false;
    this.onRecording  = options.onRecording || function (blob, phrase) {
      if (typeof saveRecording === "function") {
        var activityName = "activity";
        var path = window.location.pathname;
        if (path.indexOf("builder") >= 0) activityName = "builder";
        else if (path.indexOf("speak") >= 0) activityName = "speak";
        else if (path.indexOf("reader") >= 0) activityName = "reader";
        else if (path.indexOf("pingpong") >= 0) activityName = "pingpong";
        saveRecording(blob, activityName, phrase);
      }
    };
    this._mediaRecorder = null;
    this._audioChunks   = null;
    this._micStream     = null;

    this._active      = false;
    this._running     = false;
    this._retryCount  = 0;
    this._silenceId   = null;
    this._lastHeard   = 0;
    this._restartId   = null;
    this._rec         = null;
    this._SR          = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this._useOfflineFallback = !this._SR || !navigator.onLine;
    this.continuous   = options.continuous || false;
    this._latestTranscript = "";
  }

  PhonicsSTT.prototype._makeRec = function () {
    if (!this._SR) return null;
    var self = this;
    var rec  = new this._SR();

    rec.lang            = "en-GB";
    rec.interimResults  = true;
    rec.continuous      = true;
    rec.maxAlternatives = 1;

    rec.onstart = function () {
      self._running = true;
    };

    rec.onresult = function (event) {
      self._lastHeard = Date.now();

      var transcript = "";
      for (var i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (i < event.results.length - 1) transcript += " ";
      }
      transcript = transcript.trim();
      self._latestTranscript = transcript;

      self.onInterim(transcript);

      var last = event.results[event.resultIndex];
      if (last && last.isFinal) {
        self._gotFinal = true;
        self._retryCount = 0;
        if (self.continuous) {
          self.onFinal(transcript);
        }
      }
    };

    rec.onerror = function (event) {
      self._running = false;
      var classified = classifyError(event.error);

      if (classified.type === "aborted") return;

      if (classified.type === "silence" || classified.type === "network") {
        if (classified.type === "network") {
          if (!navigator.onLine || self._retryCount >= MAX_RETRIES - 1) {
            self._useOfflineFallback = true;
            self.onStatus("recording", "Offline Mode — local transcription active.");
            if (self._rec) {
              try { self._rec.abort(); } catch(_) {}
            }
            self._startSilenceMonitor();
            self._startAudioRecording();
            return;
          }
        }
        self._scheduleRetry(classified);
      } else {
        self._active = false;
        self._stopSilenceMonitor();
        self._stopAudioRecording();
        self.onStatus("stopped", "Stopped.");
        self.onError(classified);
      }
    };

    rec.onend = function () {
      self._running = false;

      if (!self._active) return;
      if (self._useOfflineFallback) return;

      if (self._gotFinal) {
        if (self.continuous) {
          self._gotFinal = false;
          self._scheduleRestart();
          return;
        }
        self._active = false;
        self._stopSilenceMonitor();
        self._stopAudioRecording();
        self.onStatus("stopped", "Stopped listening.");
        return;
      }

      self._scheduleRestart();
    };

    return rec;
  };

  PhonicsSTT.prototype._scheduleRestart = function () {
    var self = this;
    if (self._restartId !== null) {
      clearTimeout(self._restartId);
      self._restartId = null;
    }
    self._restartId = setTimeout(function () {
      self._restartId = null;
      if (!self._active) return;
      self._startRec();
    }, RESTART_DELAY_MS);
  };

  PhonicsSTT.prototype._scheduleRetry = function (info) {
    if (this._retryCount >= MAX_RETRIES) {
      this._active = false;
      this._stopSilenceMonitor();
      this._stopAudioRecording();
      this.onStatus("stopped", "Stopped.");
      this.onError({
        type: info.type,
        message: info.message + " (after " + MAX_RETRIES + " attempts)",
      });
      return;
    }
    this._retryCount++;
    var delay = Math.min(300 * Math.pow(2, this._retryCount), 3000);
    this.onStatus(
      "retrying",
      "Retry " + this._retryCount + "/" + MAX_RETRIES +
      " in " + Math.round(delay / 1000) + "s…"
    );
    var self = this;
    if (self._restartId !== null) {
      clearTimeout(self._restartId);
      self._restartId = null;
    }
    self._restartId = setTimeout(function () {
      self._restartId = null;
      if (!self._active) return;
      self._startRec();
    }, delay);
  };

  PhonicsSTT.prototype._startRec = function () {
    if (!this._active) return;
    if (this._running) return;

    this._gotFinal = false;
    this._rec = this._makeRec();
    if (!this._rec) return;

    try {
      this._rec.start();
    } catch (e) {
      this._running = false;
      var self = this;
      setTimeout(function () { self._scheduleRestart(); }, 200);
    }
  };

  PhonicsSTT.prototype._startSilenceMonitor = function () {
    if (this.continuous) return;
    this._stopSilenceMonitor();
    var self = this;

    this._silenceId = setInterval(function () {
      var elapsed = Date.now() - self._lastHeard;
      var timeout = 8000;

      if (self._latestTranscript && self._latestTranscript.trim().length > 0) {
        timeout = 4000;
        if (self._currentPhrase) {
          var targetWords = self._currentPhrase.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
          var spokenWords = self._latestTranscript.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
          var lastTargetWord = targetWords[targetWords.length - 1];
          var hasSpokenLast = lastTargetWord && spokenWords.indexOf(lastTargetWord) !== -1;
          if (spokenWords.length >= targetWords.length || hasSpokenLast) {
            timeout = 4000;
          }
        }
      }

      if (elapsed > timeout) {
        self._stopSilenceMonitor();
        self.stop("silence");
      }
    }, 250);
  };

  PhonicsSTT.prototype._stopSilenceMonitor = function () {
    if (this._silenceId !== null) {
      clearInterval(this._silenceId);
      this._silenceId = null;
    }
  };

  PhonicsSTT.prototype.start = function (phrase) {
    if (this._active) return;
    this._active     = true;
    this._retryCount = 0;
    this._gotFinal   = false;
    this._lastHeard  = Date.now();
    this._currentPhrase = phrase || "";
    this._useOfflineFallback = !this._SR || !navigator.onLine;
    this._latestTranscript = "";

    if (this._useOfflineFallback) {
      this.onStatus("recording", "Listening (Local Whisper)...");
    } else {
      this.onStatus("recording", "Listening (Online Speech API)...");
    }

    if (window.PhonicsAudio) window.PhonicsAudio.pauseBgm();

    this._startAudioRecording();

    if (!this._useOfflineFallback) {
      this._startRec();
    }

    this._startSilenceMonitor();
  };

  PhonicsSTT.prototype._startAudioRecording = function () {
    if (!this._recordAudio) return;
    var self = this;
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
      if (!self._active) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      self._micStream = stream;
      self._audioChunks = [];
      try {
        var mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus" : "audio/webm";
        self._mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
      } catch (e) {
        self._mediaRecorder = new MediaRecorder(stream);
      }
      var recorder = self._mediaRecorder;
      self._mediaRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) self._audioChunks.push(e.data);
      };
      self._mediaRecorder.onstop = function () {
        if (self._audioChunks && self._audioChunks.length > 0) {
          var blob = new Blob(self._audioChunks, { type: (recorder && recorder.mimeType) || "audio/webm" });

          if (self._useOfflineFallback) {
            self.onStatus("processing", "Transcribing offline...");
            var transcribeUrl = "/api/transcribe";
            fetch(transcribeUrl, {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: blob
            })
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data && data.ok) {
                var txt = data.transcript || "";
                self.onFinal(txt);
                self.onStatus("stopped", "Offline transcription complete.");
              } else {
                self.onError({ type: "offline-fail", message: "Offline transcription failed." });
              }
            })
            .catch(function (err) {
              self.onError({ type: "offline-fail", message: "Offline transcription error: " + err.message });
            });
          }

          self.onRecording(blob, self._currentPhrase);
        } else {
          console.warn("MediaRecorder stopped with 0 audio chunks.");
        }
        self._audioChunks = null;
        if (self._micStream) {
          self._micStream.getTracks().forEach(function (t) { t.stop(); });
          self._micStream = null;
        }
      };
      self._mediaRecorder.start(250);
    }).catch(function (err) {
      console.warn("MediaRecorder mic capture failed:", err);
    });
  };

  PhonicsSTT.prototype._stopAudioRecording = function () {
    if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
      try {
        if (typeof this._mediaRecorder.requestData === "function") {
          this._mediaRecorder.requestData();
        }
        this._mediaRecorder.stop();
      } catch (e) {}
    }
    this._mediaRecorder = null;
  };

  PhonicsSTT.prototype.stop = function (reason) {
    if (!this._active) return;
    this._active = false;

    if (this._restartId !== null) {
      clearTimeout(this._restartId);
      this._restartId = null;
    }

    this._stopSilenceMonitor();
    this._stopAudioRecording();

    var msg = reason === "silence" ? "No speech detected — stopped listening."
            : reason === "error"   ? "Stopped due to error."
            : "Stopped listening.";
    this.onStatus("stopped", msg, reason || "manual");
    if (window.PhonicsAudio) window.PhonicsAudio.resumeBgm();

    if (this._rec && this._running) {
      try { this._rec.abort(); } catch (_) {}
    }
    this._rec = null;

    if (!this._useOfflineFallback && reason !== "error") {
      this.onFinal(this._latestTranscript || "");
    }
  };

  PhonicsSTT.prototype.isRecording = function () {
    return this._active;
  };

  PhonicsSTT.prototype.destroy = function () {
    this.stop();
  };

  return PhonicsSTT;
})();
