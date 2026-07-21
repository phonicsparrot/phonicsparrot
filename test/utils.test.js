const fs = require('fs');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: "http://localhost:3000" });
global.window = dom.window;
global.document = dom.window.document;
global.sessionStorage = {
    getItem: () => "guest",
    setItem: () => {},
};
global.URL = {
    createObjectURL: () => "blob:url",
    revokeObjectURL: () => {}
};
global.Blob = dom.window.Blob;
global.Uint8Array = Uint8Array;
global.Array = Array;

// Mock console methods to avoid noisy test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
});

afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
});

// Load utils.js
const utilsCode = fs.readFileSync('./src/assets/js/utils.js', 'utf8');
eval(utilsCode);

test('saveRecording successful local and drive save', async () => {
    let fetchCalls = [];
    global.fetch = async (url, options) => {
        fetchCalls.push({url, options});
        return {
            ok: true,
            json: async () => ({ driveUrl: 'http://example.com' }),
            text: async () => 'ok'
        };
    };

    await saveRecording(new Blob(['test']), 'activity', 'phrase');
    assert.strictEqual(fetchCalls.length, 2);
    assert.ok(fetchCalls[0].url.startsWith('/api/save-recording?'));
    assert.ok(fetchCalls[1].url.startsWith('/api/save-recording-drive?'));
});

test('saveRecording fetch failure falls back to browser download', async () => {
    let fetchCalls = [];
    let downloadTriggered = false;

    global.fetch = async (url, options) => {
        fetchCalls.push({url, options});
        // Reject fetch to simulate network error or offline mode
        throw new Error("Network error");
    };

    // Mock the anchor creation and click for the fallback download
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName) {
        if (tagName === 'a') {
            const anchor = originalCreateElement('a');
            let clickOriginal = anchor.click.bind(anchor);
            anchor.click = function() {
                downloadTriggered = true;
                clickOriginal();
            };
            return anchor;
        }
        return originalCreateElement(tagName);
    };

    await saveRecording(new Blob(['test']), 'activity', 'phrase');

    assert.strictEqual(fetchCalls.length, 1, "Should try to fetch once and throw");
    assert.strictEqual(downloadTriggered, true, "Fallback download should be triggered");

    // Restore
    document.createElement = originalCreateElement;
});

test('saveRecording generic error boundary catches sync errors', async () => {
    // Override Date to throw synchronously
    const originalDate = global.Date;
    global.Date = function() {
        throw new Error("Simulated synchronous error");
    };

    let consoleErrorCalls = [];
    console.error = (...args) => {
        consoleErrorCalls.push(args);
    };

    await saveRecording(new Blob(['test']), 'activity', 'phrase');

    assert.strictEqual(consoleErrorCalls.length, 1);
    assert.ok(consoleErrorCalls[0][0].includes("saveRecording failed"));
    assert.strictEqual(consoleErrorCalls[0][1].message, "Simulated synchronous error");

    // Restore
    global.Date = originalDate;
});

test('saveRecording HTTP failure on local API save fallback to browser download', async () => {
    let fetchCalls = [];
    let downloadTriggered = false;

    global.fetch = async (url, options) => {
        fetchCalls.push({url, options});
        // HTTP Error Response
        return {
            ok: false,
            status: 500,
            json: async () => ({}),
            text: async () => 'Internal Server Error'
        };
    };

    // Mock the anchor creation and click for the fallback download
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName) {
        if (tagName === 'a') {
            const anchor = originalCreateElement('a');
            let clickOriginal = anchor.click.bind(anchor);
            anchor.click = function() {
                downloadTriggered = true;
                clickOriginal();
            };
            return anchor;
        }
        return originalCreateElement(tagName);
    };

    await saveRecording(new Blob(['test']), 'activity', 'phrase');

    assert.strictEqual(fetchCalls.length, 2, "Should try both local and drive API fetch when local fails with HTTP error");
    assert.strictEqual(downloadTriggered, true, "Fallback download should be triggered");

    // Restore
    document.createElement = originalCreateElement;
});

test('saveRecording Tauri save succeeds', async () => {
    let tauriInvoked = false;
    let fallbackTriggered = false;

    // Mock Tauri
    global.window.__TAURI__ = {
        core: {
            invoke: async (cmd, args) => {
                if (cmd === "save_audio_recording") {
                    tauriInvoked = true;
                }
            }
        }
    };

    let fetchCalled = false;
    global.fetch = async (url, options) => {
        fetchCalled = true;
        return { ok: true, json: async () => ({ driveUrl: 'http://example.com' }) };
    };

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName) {
        if (tagName === 'a') {
            const anchor = originalCreateElement('a');
            let clickOriginal = anchor.click.bind(anchor);
            anchor.click = function() {
                fallbackTriggered = true;
                clickOriginal();
            };
            return anchor;
        }
        return originalCreateElement(tagName);
    };

    await saveRecording(new Blob(['test']), 'activity', 'phrase');

    assert.strictEqual(tauriInvoked, true, "Tauri save_audio_recording should be invoked");
    assert.strictEqual(fetchCalled, false, "Local API fetch should NOT be called if Tauri succeeds");
    assert.strictEqual(fallbackTriggered, false, "Fallback download should NOT be triggered if Tauri succeeds");

    // Restore
    delete global.window.__TAURI__;
    document.createElement = originalCreateElement;
});

test('saveRecording Tauri save fails, falls back to local API', async () => {
    let tauriInvoked = false;

    // Mock Tauri to throw error
    global.window.__TAURI__ = {
        core: {
            invoke: async (cmd, args) => {
                if (cmd === "save_audio_recording") {
                    tauriInvoked = true;
                    throw new Error("Tauri failed");
                }
            }
        }
    };

    let fetchCalls = [];
    global.fetch = async (url, options) => {
        fetchCalls.push({url, options});
        return {
            ok: true,
            json: async () => ({ driveUrl: 'http://example.com' }),
            text: async () => 'ok'
        };
    };

    await saveRecording(new Blob(['test']), 'activity', 'phrase');

    assert.strictEqual(tauriInvoked, true, "Tauri save_audio_recording should be invoked");
    assert.strictEqual(fetchCalls.length, 2, "Local and drive API fetch SHOULD be called if Tauri fails");
    assert.ok(fetchCalls[0].url.startsWith('/api/save-recording?'));

    // Restore
    delete global.window.__TAURI__;
});
