const fs = require('fs');

// Mock browser APIs required by utils.js
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: () => {},
  location: { pathname: '' }
};
global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  createElement: () => ({
    style: {},
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {} },
    querySelector: () => null
  }),
  body: { appendChild: () => {}, removeChild: () => {} }
};
global.localStorage = { getItem: () => null, setItem: () => {}, clear: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, clear: () => {} };
global.URL = { createObjectURL: () => '', revokeObjectURL: () => {} };
global.fetch = () => Promise.resolve({ ok: true });

// Read and eval utils.js to get its functions in global scope
const utilsCode = fs.readFileSync('./src/assets/js/utils.js', 'utf8');
eval(utilsCode);

describe('censor', () => {
  it('should return the original text and dirty=false for clean text', () => {
    const result = censor('Hello world');
    expect(result.text).toBe('Hello world');
    expect(result.dirty).toBe(false);
  });

  it('should replace a single profanity word with an emoji', () => {
    const result = censor('fuck');
    expect(result.text).toBe('🦜');
    expect(result.dirty).toBe(true);
  });

  it('should ignore words that only contain a profanity as a substring', () => {
    const result = censor('classic');
    expect(result.text).toBe('classic');
    expect(result.dirty).toBe(false);
  });

  it('should handle empty input', () => {
    const result = censor('');
    expect(result.text).toBe('');
    expect(result.dirty).toBe(false);
  });

  it('should handle null/undefined input', () => {
    const result = censor(null);
    expect(result.text).toBe('');
    expect(result.dirty).toBe(false);
  });

  it('should censor multiple occurrences of the same word', () => {
    const result = censor('shit and shit');
    expect(result.text).toBe('🦜 and 🦜');
    expect(result.dirty).toBe(true);
  });

  it('should censor multiple different profanity words', () => {
    const result = censor('fuck and shit');
    expect(result.text).toBe('🦜 and 🦜');
    expect(result.dirty).toBe(true);
  });

  it('should be case-insensitive for matching but preserve case for surrounding text', () => {
    const result = censor('FUCK this SHIT');
    expect(result.text).toBe('🦜 this 🦜');
    expect(result.dirty).toBe(true);
  });

  it('should censor profanity at word boundaries', () => {
    const result = censor('hello, fuck. world!');
    expect(result.text).toBe('hello, 🦜. world!');
    expect(result.dirty).toBe(true);
  });
});
