import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VERSION } from '../src/version.js';

describe('version', () => {
  it('is a non-empty string', () => {
    assert.strictEqual(typeof VERSION, 'string');
    assert.ok(VERSION.length > 0);
  });

  it('matches strict semver', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    assert.ok(semverRegex.test(VERSION), `VERSION "${VERSION}" is not valid semver`);
  });

  it('matches package.json version', async () => {
    const pkg = JSON.parse(await (await import('fs/promises')).readFile(new URL('../package.json', import.meta.url), 'utf-8'));
    assert.strictEqual(VERSION, pkg.version);
  });
});
