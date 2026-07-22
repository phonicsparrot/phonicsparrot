/**
 * server.js — Phonics Parrot dev server
 * Serves src/ on port 3000 for browser development.
 * Usage: node server.js  →  http://localhost:3000
 */
const http = require("http");
const fs   = require("fs");
const path = require("path");
const os   = require("os");
const https = require("https");
const { execFile } = require("child_process");

const PORT = 3000;
const ROOT = path.join(__dirname, "src");

// Load drive config (Apps Script URL) from drive_config.json if present
let APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || "";
const DRIVE_CONFIG_PATH = path.join(__dirname, "drive_config.json");
if (!APPS_SCRIPT_URL && fs.existsSync(DRIVE_CONFIG_PATH)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(DRIVE_CONFIG_PATH, "utf8"));
    APPS_SCRIPT_URL = cfg.appsScriptUrl || "";
  } catch (e) { /* ignore */ }
}

const MIME = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8", ".json":"application/json",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg",
  ".gif":"image/gif", ".svg":"image/svg+xml", ".webp":"image/webp",
  ".ico":"image/x-icon", ".wasm":"application/wasm",
  ".mp3":"audio/mpeg", ".wav":"audio/wav", ".webm":"audio/webm",
  ".ttf":"font/ttf", ".woff":"font/woff", ".woff2":"font/woff2",
};

const HEADERS = {
  "Cross-Origin-Opener-Policy":"same-origin",
  "Cross-Origin-Embedder-Policy":"credentialless",
  "Access-Control-Allow-Origin":"*",
};

function serve(res, fp) {
  const ext = path.extname(fp).toLowerCase();
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, {"Content-Type":MIME[ext]||"application/octet-stream", ...HEADERS});
    res.end(d);
  });
}

/**
 * POST a JSON payload to Google Apps Script Web App URL.
 * Apps Script processes doPost(e) on the initial POST and responds with 302.
 * The redirected response MUST be fetched via GET (https.get) to retrieve the JSON output.
 */
function postToAppsScript(urlStr, payloadString, res, callback) {
  if (!urlStr || urlStr.indexOf("YOUR_DEPLOYMENT_ID_HERE") !== -1) {
    if (callback) callback(new Error("Apps Script URL not configured"));
    return;
  }

  const payloadSize = Buffer.byteLength(payloadString);
  const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    if (res && res.writeHead) {
      res.writeHead(413, { "Content-Type": "application/json", ...HEADERS });
      res.end(JSON.stringify({ ok: false, error: "Payload too large. Max size is 4MB." }));
    }
    if (callback) callback(new Error("Payload too large (413)"));
    return;
  }
  try {
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payloadString)
      }
    };
    const req = https.request(options, (res) => {
      // Follow redirects (Apps Script returns 302 to usercontent.com)
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) && res.headers.location) {
        res.resume();
        https.get(res.headers.location, (redRes) => {
          let body = "";
          redRes.on("data", chunk => { body += chunk; });
          redRes.on("end", () => { if (callback) callback(null, body); });
        }).on("error", (err) => { if (callback) callback(err); });
        return;
      }
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => { if (callback) callback(null, body); });
    });
    req.on("error", (err) => { if (callback) callback(err); });
    req.write(payloadString);
    req.end();
  } catch (err) {
    if (callback) callback(err);
  }
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url;
  let url = decodeURIComponent(rawUrl.split("?")[0]);

  // CORS preflight
  if (req.method === "OPTIONS" && url.startsWith("/api/")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...HEADERS
    });
    res.end();
    return;
  }

  if (url === "/api/save-recording" && req.method === "POST") {
    try {
      const parsedUrl = new URL(rawUrl, "http://localhost");
      const className = (parsedUrl.searchParams.get("class") || "guest").replace(/[^a-zA-Z0-9-_]/g, "_");
      const student = (parsedUrl.searchParams.get("student") || "guest").replace(/[^a-zA-Z0-9-_]/g, "_");
      const activity = (parsedUrl.searchParams.get("activity") || "activity").replace(/[^a-zA-Z0-9-_]/g, "_");
      const filename = (parsedUrl.searchParams.get("filename") || "recording.webm").replace(/[^a-zA-Z0-9-_[\].]/g, "_");

      const activityMap = {
        "builder": "flashcard_builder",
        "reader": "line_reader",
        "speak": "poem_builder",
        "pingpong": "phonics_pong"
      };
      const folderName = activityMap[activity] || activity;

      const dirPath = path.join(__dirname, "recordings", className, student, folderName);
      fs.mkdirSync(dirPath, { recursive: true });

      const filePath = path.join(dirPath, filename);
      const fileStream = fs.createWriteStream(filePath);

      req.pipe(fileStream);

      fileStream.on("finish", () => {
        res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
        res.end(JSON.stringify({ ok: true, path: filePath }));
      });

      fileStream.on("error", (err) => {
        res.writeHead(500);
        res.end("Error writing file: " + err.message);
      });

      req.on("error", (err) => {
        res.writeHead(500);
        res.end("Error reading request: " + err.message);
      });
    } catch (e) {
      res.writeHead(400);
      res.end("Invalid request: " + e.message);
    }
    return;
  }

  if (url === "/api/config" && req.method === "GET") {
    const isDist = __dirname.indexOf("phonics-parrot-dist") !== -1;
    res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
    res.end(JSON.stringify({ debugModeAllowed: !isDist }));
    return;
  }

  if (url === "/api/transcribe" && req.method === "POST") {
    const tempWebmPath = path.join(os.tmpdir(), "pp_temp_" + Date.now() + ".webm");
    const tempWavPath = path.join(os.tmpdir(), "pp_temp_" + Date.now() + ".wav");
    const writeStream = fs.createWriteStream(tempWebmPath);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      const ffmpegCmd = "ffmpeg";
      const ffmpegArgs = ["-y", "-i", tempWebmPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", tempWavPath];

      execFile(ffmpegCmd, ffmpegArgs, (err) => {
        if (err) {
          try { fs.unlinkSync(tempWebmPath); } catch(_) { /* ignore */ }
          try { fs.unlinkSync(tempWavPath); } catch(_) { /* ignore */ }
          res.writeHead(500, { "Content-Type": "application/json", ...HEADERS });
          res.end(JSON.stringify({ ok: false, error: "ffmpeg conversion failed: " + err.message }));
          return;
        }

        const whisperPath = path.join(__dirname, "bin", "whisper", "whisper-cli.exe");
        const modelPath = path.join(__dirname, "bin", "whisper", "ggml-tiny.en.bin");
        const whisperArgs = ["-m", modelPath, "-f", tempWavPath, "--no-timestamps", "--no-prints"];

        execFile(whisperPath, whisperArgs, (err, stdout) => {
          try { fs.unlinkSync(tempWebmPath); } catch(_) { /* ignore */ }
          try { fs.unlinkSync(tempWavPath); } catch(_) { /* ignore */ }

          if (err) {
            res.writeHead(500, { "Content-Type": "application/json", ...HEADERS });
            res.end(JSON.stringify({ ok: false, error: "whisper transcription failed: " + err.message }));
            return;
          }

          const transcript = stdout.replace(/\[BLANK_AUDIO\]/gi, "").trim();
          res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
          res.end(JSON.stringify({ ok: true, transcript: transcript }));
        });
      });
    });

    writeStream.on("error", (err) => {
      try { fs.unlinkSync(tempWebmPath); } catch(_) { /* ignore */ }
      res.writeHead(500, { "Content-Type": "application/json", ...HEADERS });
      res.end(JSON.stringify({ ok: false, error: "Failed to save temp file: " + err.message }));
    });
    return;
  }

  if (url === "/api/save-comment" && req.method === "POST") {
    const isDist = __dirname.indexOf("phonics-parrot-dist") !== -1;
    if (isDist) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const commentObj = JSON.parse(body);
        const commentsPath = path.join(ROOT, "debug_comments.json");
        let comments = [];
        if (fs.existsSync(commentsPath)) {
          try { comments = JSON.parse(fs.readFileSync(commentsPath, "utf8")); } catch (_) { /* ignore */ }
        }
        comments.push(commentObj);
        fs.writeFileSync(commentsPath, JSON.stringify(comments, null, 2), "utf8");
        res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end("Invalid JSON: " + e.message);
      }
    });
    return;
  }

  if (url === "/api/save-log" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        JSON.parse(body);
        const logPath = path.join(__dirname, "performance_log.json");
        fs.appendFile(logPath, body + "\n", err => {
          if (err) {
            res.writeHead(500);
            res.end("Error writing log: " + err.message);
            return;
          }

          if (APPS_SCRIPT_URL) {
            postToAppsScript(APPS_SCRIPT_URL, body, res, (err) => {
              if (err) {
                console.warn("[Google Sheets Log Warning]", err.message);
                if (err.message !== "Payload too large (413)") {
                  res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
                  res.end(JSON.stringify({ ok: true }));
                }
              } else {
                console.log("[Google Sheets Log] Recorded entry successfully");
                res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
                res.end(JSON.stringify({ ok: true }));
              }
            });
          } else {
            res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
            res.end(JSON.stringify({ ok: true }));
          }
        });
      } catch (e) {
        res.writeHead(400);
        res.end("Invalid JSON: " + e.message);
      }
    });
    return;
  }

  if (url === "/api/save-recording-drive" && req.method === "POST") {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("YOUR_DEPLOYMENT_ID_HERE") !== -1) {
      console.warn("[Drive Proxy] Apps Script URL not configured in drive_config.json");
      res.writeHead(503, { "Content-Type": "application/json", ...HEADERS });
      res.end(JSON.stringify({ ok: false, error: "Apps Script URL not configured. Add drive_config.json." }));
      return;
    }
    const parsedUrl = new URL(rawUrl, "http://localhost");
    const meta = {
      student:   (parsedUrl.searchParams.get("student")  || "guest").trim(),
      class:     (parsedUrl.searchParams.get("class")    || "guest").trim(),
      activity:  (parsedUrl.searchParams.get("activity") || "activity").trim(),
      target:    (parsedUrl.searchParams.get("target")   || "").trim(),
      phoneme:   (parsedUrl.searchParams.get("phoneme")  || "").trim(),
      spoken:    (parsedUrl.searchParams.get("spoken")   || "").trim(),
      score:     parsedUrl.searchParams.get("score") || "",
      verdict:   (parsedUrl.searchParams.get("verdict")  || "").trim(),
      filename:  (parsedUrl.searchParams.get("filename") || "recording.webm").trim(),
      timestamp: new Date().toISOString()
    };
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const audioBase64 = Buffer.concat(chunks).toString("base64");
      console.log(`[Drive Proxy] Uploading audio for ${meta.student} (${meta.class}, ${meta.activity}) - Payload size: ${Math.round(audioBase64.length/1024)} KB`);
      const payload = JSON.stringify({ ...meta, audioData: audioBase64 });
      postToAppsScript(APPS_SCRIPT_URL, payload, res, (err, body) => {
        if (err) {
          console.error("[Drive Proxy Error]", err.message);
          if (err.message !== "Payload too large (413)") {
            res.writeHead(502, { "Content-Type": "application/json", ...HEADERS });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
          return;
        }
        console.log("[Drive Proxy Response]", body);
        let driveUrl = "";
        try {
          const parsed = JSON.parse(body);
          driveUrl = parsed.driveUrl || "";
        } catch (_) { /* ignore */ }
        res.writeHead(200, { "Content-Type": "application/json", ...HEADERS });
        res.end(JSON.stringify({ ok: true, driveUrl: driveUrl, driveResponse: body }));
      });
    });
    return;
  }

  if (url.length>1 && url.endsWith("/")) url = url.slice(0,-1);
  if (url === "/") url = "/index";
  const fp = path.resolve(ROOT, "." + url);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end("403"); return; }
  if (!path.extname(url)) {
    if (fs.existsSync(fp+".html")) return serve(res, fp+".html");
    if (fs.existsSync(path.join(fp,"index.html"))) return serve(res, path.join(fp,"index.html"));
    res.writeHead(404); res.end("404"); return;
  }
  serve(res, fp);
});

let _currentPort = PORT;
function startServer(port) {
  _currentPort = port;
  server.listen(port, "0.0.0.0");
}

server.on("listening", () => {
  const port = server.address().port;
  console.log("\n  🦜 Phonics Parrot is running!");
  console.log("  Local:            http://127.0.0.1:" + port);
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`  On your network:  http://${iface.address}:${port}`);
      }
    }
  }
  console.log("\n  Keep this terminal window open.\n");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const next = _currentPort + 1;
    if (next > PORT + 10) {
      console.error("\n  ❌ Could not find a free port in range " + PORT + "–" + (PORT + 10) + ".");
      console.error("  Close other programs using these ports and try again.\n");
      process.exit(1);
    }
    console.warn("  ⚠️  Port " + _currentPort + " is busy — trying port " + next + "...");
    server.close();
    startServer(next);
  } else {
    throw err;
  }
});

startServer(PORT);
