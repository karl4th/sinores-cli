import { describe, it } from 'node:test';
import assert from 'node:assert';
import { countTokens } from '../src/services/tokenizer.js';

describe('tokenizer', () => {
  it('returns 0 for empty string', () => {
    assert.strictEqual(countTokens(''), 0);
  });

  it('returns 0 for null/undefined coerced', () => {
    assert.strictEqual(countTokens(null as unknown as string), 0);
  });

  it('approximates by ceil(length / 4)', () => {
    assert.strictEqual(countTokens('abcd'), 1);       // 4 chars -> 1 token
    assert.strictEqual(countTokens('abcde'), 2);      // 5 chars -> 2 tokens
    assert.strictEqual(countTokens('abc'), 1);        // 3 chars -> 1 token
  });

  it('handles large text', () => {
    const text = 'x'.repeat(10_000);
    assert.strictEqual(countTokens(text), 2500); // 10000 / 4 = 2500
  });
});
