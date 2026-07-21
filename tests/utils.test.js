const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../src/assets/js/utils.js'), 'utf8');

// Mock browser globals
global.window = {
  crypto: { subtle: { importKey: async () => {}, sign: async () => {} } },
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  addEventListener: () => {}
};
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.localStorage = { getItem: () => null, setItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {} };
global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => [],
};
global.TextEncoder = class { encode() { return new Uint8Array(); } };

eval(code);

test('appendRowToGoogleSheet success path', async (t) => {
  let fetchCallCount = 0;
  global.fetch = async (url, options) => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      // First call is to get token
      return {
        json: async () => ({ access_token: 'fake-token' })
      };
    } else {
      // Second call is to append row
      return {
        json: async () => ({ updates: { updatedRows: 1 } })
      };
    }
  };

  const serviceAccountJson = JSON.stringify({
    client_email: 'test@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----',
    token_uri: 'https://oauth2.googleapis.com/token'
  });

  const result = await appendRowToGoogleSheet('fake-id', serviceAccountJson, ['A', 'B']);
  assert.deepStrictEqual(result, { updates: { updatedRows: 1 } });
});

test('appendRowToGoogleSheet throws error when response contains error message', async (t) => {
  let fetchCallCount = 0;
  global.fetch = async (url, options) => {
    fetchCallCount++;
    if (fetchCallCount === 1) {
      // First call is to get token
      return {
        json: async () => ({ access_token: 'fake-token' })
      };
    } else {
      // Second call is to append row
      return {
        json: async () => ({ error: { message: 'Google Sheets API error' } })
      };
    }
  };

  const serviceAccountJson = JSON.stringify({
    client_email: 'test@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----',
    token_uri: 'https://oauth2.googleapis.com/token'
  });

  await assert.rejects(
    appendRowToGoogleSheet('fake-id', serviceAccountJson, ['A', 'B']),
    /Google Sheets API error/
  );
});
