/**
 * @jest-environment jsdom
 */

// Mock fetch and other missing APIs in JSDOM if needed
global.fetch = jest.fn();

const { getAcousticSkeleton, censor } = require('../src/assets/js/utils.js');

describe('utils.js', () => {
  describe('getAcousticSkeleton', () => {
    test('returns empty string for empty input', () => {
      expect(getAcousticSkeleton('')).toBe('');
      expect(getAcousticSkeleton(null)).toBe('');
      expect(getAcousticSkeleton(undefined)).toBe('');
    });

    test('handles exceptions correctly', () => {
      expect(getAcousticSkeleton('choir')).toBe('KR');
      expect(getAcousticSkeleton('quire')).toBe('KR');
    });

    test('replaces consonants correctly according to phonetic rules', () => {
      expect(getAcousticSkeleton('bat')).toBe('PT'); // B->P, T->T
      expect(getAcousticSkeleton('cat')).toBe('KT'); // C->K (before a), T->T
      expect(getAcousticSkeleton('cell')).toBe('SL'); // C->S (before e), L->L
      expect(getAcousticSkeleton('dog')).toBe('TK'); // D->T, G->K
    });

    test('removes vowels and non-alphabet characters', () => {
      expect(getAcousticSkeleton('apple 123!')).toBe('PL');
    });
  });

  describe('censor', () => {
    test('handles empty input', () => {
      expect(censor('').text).toBe('');
      expect(censor('').dirty).toBe(false);
      expect(censor(null).text).toBe('');
      expect(censor(undefined).text).toBe('');
    });

    test('does not censor clean text', () => {
      const result = censor('hello world');
      expect(result.text).toBe('hello world');
      expect(result.dirty).toBe(false);
    });

    test('censors profanity with parrot emoji', () => {
      const result = censor('this is shit');
      expect(result.text).toBe('this is 🦜');
      expect(result.dirty).toBe(true);
    });

    test('preserves case of non-censored text', () => {
      const result = censor('This Is Shit');
      expect(result.text).toBe('This Is 🦜');
      expect(result.dirty).toBe(true);
    });

    test('checks word boundaries', () => {
      const result = censor('bullshit');
      // The implementation uses \W.test(), which checks for non-word chars.
      // So 'bullshit' has 'shit' not preceded by a word boundary.
      // It should NOT be censored because there's no boundary.
      expect(result.text).toBe('bullshit');
      expect(result.dirty).toBe(false);

      const result2 = censor('shit-faced');
      // Here 'shit' is followed by '-', which is \W, so it SHOULD be censored.
      expect(result2.text).toBe('🦜-faced');
      expect(result2.dirty).toBe(true);
    });
  });
});
