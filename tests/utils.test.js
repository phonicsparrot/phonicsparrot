/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

// Read the utils.js file content
const utilsPath = path.resolve(__dirname, '../src/assets/js/utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');

// Evaluate the code in the current context
eval(utilsCode);

describe('levenshtein', () => {
  it('should be defined', () => {
    expect(typeof levenshtein).toBe('function');
  });

  it('should return 0 for two empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('should return the length of the string if the other string is empty', () => {
    expect(levenshtein('hello', '')).toBe(5);
    expect(levenshtein('', 'world')).toBe(5);
  });

  it('should return 0 for identical strings', () => {
    expect(levenshtein('phonics', 'phonics')).toBe(0);
    expect(levenshtein('parrot', 'parrot')).toBe(0);
  });

  it('should return the correct distance for completely different strings of same length', () => {
    expect(levenshtein('abc', 'def')).toBe(3);
    expect(levenshtein('dog', 'cat')).toBe(3);
  });

  it('should return the correct distance for strings of different lengths', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('flitten', 'kitten')).toBe(2);
  });

  it('should calculate distance correctly for real-world phonics words', () => {
    expect(levenshtein('bat', 'cat')).toBe(1); // 1 substitution
    expect(levenshtein('stop', 'top')).toBe(1); // 1 deletion
    expect(levenshtein('read', 'red')).toBe(1); // 1 deletion
    expect(levenshtein('night', 'knight')).toBe(1); // 1 insertion
    expect(levenshtein('choir', 'quire')).toBe(4);
    expect(levenshtein('through', 'though')).toBe(1); // 1 deletion
  });

  it('should calculate distance for single character strings', () => {
    expect(levenshtein('a', 'b')).toBe(1);
    expect(levenshtein('a', 'a')).toBe(0);
    expect(levenshtein('a', '')).toBe(1);
  });

  it('should calculate correctly for case sensitivity (assumes case-sensitive by default)', () => {
    expect(levenshtein('Cat', 'cat')).toBe(1);
  });
});

describe('phoneticLevenshtein', () => {
  it('should be defined', () => {
    expect(typeof phoneticLevenshtein).toBe('function');
  });

  it('should calculate phonetic distance correctly', () => {
    expect(phoneticLevenshtein('choir', 'quire')).toBe(0);
    expect(phoneticLevenshtein('read', 'red')).toBe(0);
    expect(phoneticLevenshtein('see', 'sea')).toBe(0);
    expect(phoneticLevenshtein('know', 'no')).toBe(0);
  });
});
