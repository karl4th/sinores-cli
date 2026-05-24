import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SYSTEM_PROMPT } from '../src/services/prompt.js';

describe('prompt', () => {
  it('is non-empty', () => {
    assert.ok(SYSTEM_PROMPT.length > 100);
  });

  it('contains identity declaration', () => {
    assert.ok(SYSTEM_PROMPT.includes('Sinores'));
    assert.ok(SYSTEM_PROMPT.includes('autonomous coding agent'));
  });

  it('contains tool usage rules', () => {
    assert.ok(SYSTEM_PROMPT.includes('Read before write'));
    assert.ok(SYSTEM_PROMPT.includes('Understand before run'));
    assert.ok(SYSTEM_PROMPT.includes('Verify after change'));
  });

  it('contains code quality guidelines', () => {
    assert.ok(SYSTEM_PROMPT.includes('error handling'));
    assert.ok(SYSTEM_PROMPT.includes('Never guess file contents'));
  });

  it('contains git commit format', () => {
    assert.ok(SYSTEM_PROMPT.includes('feat:'));
    assert.ok(SYSTEM_PROMPT.includes('Co-authored-by: Sinores'));
  });

  it('contains terminal formatting rules', () => {
    assert.ok(SYSTEM_PROMPT.includes('No **bold**'));
    assert.ok(SYSTEM_PROMPT.includes('No *italic*'));
  });

  it('contains prohibitions', () => {
    assert.ok(SYSTEM_PROMPT.includes('Never output placeholder code'));
    assert.ok(SYSTEM_PROMPT.includes('Never truncate implementations'));
    assert.ok(SYSTEM_PROMPT.includes('Never fabricate file contents'));
  });
});
