import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  permissionKey,
  describeCall,
  executeTool,
  type ToolName,
  CWD,
} from '../src/services/tools.js';

describe('tools', () => {
  const tmpDir = path.join(os.tmpdir(), `sinores-test-${Date.now()}`);

  before(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('permissionKey', () => {
    it('scopes read_file by path', () => {
      assert.strictEqual(
        permissionKey('read_file', { path: 'foo.ts' }),
        'read_file:foo.ts'
      );
    });

    it('scopes run_command by command string', () => {
      assert.strictEqual(
        permissionKey('run_command', { command: 'npm test' }),
        'run_command:npm test'
      );
    });

    it('scopes search_files by pattern', () => {
      assert.strictEqual(
        permissionKey('search_files', { pattern: 'TODO' }),
        'search_files:TODO'
      );
    });

    it('defaults list_dir to cwd when path omitted', () => {
      assert.strictEqual(
        permissionKey('list_dir', {}),
        'list_dir:.'
      );
    });
  });

  describe('describeCall', () => {
    it('formats read_file', () => {
      assert.ok(describeCall('read_file', { path: 'src/app.ts' }).includes('src/app.ts'));
    });

    it('formats run_command', () => {
      assert.ok(describeCall('run_command', { command: 'ls' }).includes('ls'));
    });
  });

  describe('executeTool', () => {
    describe('write_file + read_file round-trip', () => {
      it('writes then reads back exact content', async () => {
        const filePath = path.join(tmpDir, 'roundtrip.txt');
        const content = 'Hello, Sinores!\nMulti-line\nContent.';

        const writeResult = await executeTool('write_file', {
          path: filePath,
          content,
        });
        assert.ok(writeResult.includes('Written'));
        assert.ok(writeResult.includes(String(content.length)));

        const readResult = await executeTool('read_file', { path: filePath });
        assert.strictEqual(readResult, content);
      });

      it('creates nested directories automatically', async () => {
        const nested = path.join(tmpDir, 'a', 'b', 'c', 'nested.txt');
        await executeTool('write_file', { path: nested, content: 'deep' });
        const data = await fs.readFile(nested, 'utf-8');
        assert.strictEqual(data, 'deep');
      });
    });

    describe('edit_file', () => {
      it('replaces all occurrences', async () => {
        const filePath = path.join(tmpDir, 'edit.txt');
        await fs.writeFile(filePath, 'foo bar foo baz foo', 'utf-8');

        const result = await executeTool('edit_file', {
          path: filePath,
          old_str: 'foo',
          new_str: 'qux',
        });
        assert.ok(result.includes('3 occurrences'));

        const data = await fs.readFile(filePath, 'utf-8');
        assert.strictEqual(data, 'qux bar qux baz qux');
      });

      it('errors when old_str not found', async () => {
        const filePath = path.join(tmpDir, 'noedit.txt');
        await fs.writeFile(filePath, 'hello world', 'utf-8');

        const result = await executeTool('edit_file', {
          path: filePath,
          old_str: 'notfound',
          new_str: 'x',
        });
        assert.ok(result.startsWith('Error:'));
      });
    });

    describe('list_dir', () => {
      it('lists files and directories with markers', async () => {
        const dir = path.join(tmpDir, 'listme');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'a.txt'), '', 'utf-8');
        await fs.mkdir(path.join(dir, 'sub'));

        const result = await executeTool('list_dir', { path: dir });
        assert.ok(result.includes('f  a.txt'));
        assert.ok(result.includes('d  sub'));
      });
    });

    describe('delete_file', () => {
      it('deletes an existing file', async () => {
        const filePath = path.join(tmpDir, 'todelete.txt');
        await fs.writeFile(filePath, 'bye', 'utf-8');

        const result = await executeTool('delete_file', { path: filePath });
        assert.ok(result.includes('Deleted'));

        await assert.rejects(fs.access(filePath), /ENOENT/);
      });
    });

    describe('run_command', () => {
      it('captures stdout', async () => {
        const result = await executeTool('run_command', { command: 'echo hello-from-test' });
        assert.ok(result.includes('hello-from-test'));
      });

      it('handles command not found gracefully', async () => {
        const result = await executeTool('run_command', { command: 'definitely_not_a_real_command_12345' });
        assert.ok(result.includes('Error') || result.includes('not found') || result.includes('exited'));
      });
    });

    describe('search_files', () => {
      it('finds pattern in files', async () => {
        const dir = path.join(tmpDir, 'search');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'a.ts'), 'const x = 42;', 'utf-8');
        await fs.writeFile(path.join(dir, 'b.js'), 'var y = 42;', 'utf-8');

        const result = await executeTool('search_files', {
          pattern: '42',
          path: dir,
        });
        assert.ok(result.includes('a.ts'));
        assert.ok(result.includes('b.js'));
      });

      it('respects file_pattern glob', async () => {
        const dir = path.join(tmpDir, 'search2');
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, 'a.ts'), 'const x = 99;', 'utf-8');
        await fs.writeFile(path.join(dir, 'b.js'), 'var y = 99;', 'utf-8');

        const result = await executeTool('search_files', {
          pattern: '99',
          path: dir,
          file_pattern: '*.ts',
        });
        assert.ok(result.includes('a.ts'));
        assert.ok(!result.includes('b.js'));
      });
    });
  });
});
