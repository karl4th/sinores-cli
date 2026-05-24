import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export const CWD = process.cwd();

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the full contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to cwd or absolute' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with new content',
      parameters: {
        type: 'object',
        properties: {
          path:    { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_file',
      description: 'Replace ALL occurrences of an exact string in a file',
      parameters: {
        type: 'object',
        properties: {
          path:    { type: 'string', description: 'File path' },
          old_str: { type: 'string', description: 'Exact string to find (all occurrences replaced)' },
          new_str: { type: 'string', description: 'Replacement string' },
        },
        required: ['path', 'old_str', 'new_str'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List files and folders in a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: cwd)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description: 'Run a shell command in the current working directory',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_file',
      description: 'Delete a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_files',
      description: 'Search for a pattern across files using grep',
      parameters: {
        type: 'object',
        properties: {
          pattern:      { type: 'string', description: 'Search pattern (literal string or regex)' },
          path:         { type: 'string', description: 'Directory to search (default: cwd)' },
          file_pattern: { type: 'string', description: 'Glob for file types e.g. "*.ts"' },
        },
        required: ['pattern'],
      },
    },
  },
] as const;

export type ToolName =
  | 'read_file' | 'write_file' | 'edit_file'
  | 'list_dir'  | 'run_command' | 'delete_file' | 'search_files';

// #2 fix: key includes path/command so "session allow" is scoped to specific file/command
export function permissionKey(name: ToolName, args: Record<string, string>): string {
  switch (name) {
    case 'read_file':    return `read_file:${args['path']}`;
    case 'write_file':   return `write_file:${args['path']}`;
    case 'edit_file':    return `edit_file:${args['path']}`;
    case 'delete_file':  return `delete_file:${args['path']}`;
    case 'list_dir':     return `list_dir:${args['path'] ?? '.'}`;
    case 'run_command':  return `run_command:${args['command']}`;
    case 'search_files': return `search_files:${args['pattern']}`;
    default:             return name;
  }
}

export function describeCall(name: ToolName, args: Record<string, string>): string {
  switch (name) {
    case 'read_file':    return `Read    ${args['path']}`;
    case 'write_file':   return `Write   ${args['path']}`;
    case 'edit_file':    return `Edit    ${args['path']}`;
    case 'list_dir':     return `List    ${args['path'] ?? '.'}`;
    case 'run_command':  return `Run     ${args['command']}`;
    case 'delete_file':  return `Delete  ${args['path']}`;
    case 'search_files': return `Search  "${args['pattern']}"`;
    default:             return name;
  }
}

function abs(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(CWD, p);
}

// Spawn helper — no buffer overflow, no shell injection via string interpolation
function spawnCollect(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeout?: number; signal?: AbortSignal },
): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: opts.cwd });
    let out = '';
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const append = (d: Buffer) => {
      out += d.toString();
      // Rolling 100 KB cap so we never OOM on huge output
      if (out.length > 100_000) out = out.slice(-100_000);
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    proc.stdout.on('data', append);
    proc.stderr.on('data', append);
    proc.on('close',  (code) => { cleanup(); resolve(out || `(exited ${code})`); });
    proc.on('error',  (err)  => { cleanup(); resolve(`Error: ${err.message}`); });

    if (opts.timeout) {
      timeoutId = setTimeout(() => { proc.kill(); resolve('(timeout)'); }, opts.timeout);
    }
    opts.signal?.addEventListener('abort', () => { proc.kill(); resolve('(cancelled)'); });
  });
}

export async function executeTool(
  name: ToolName,
  args: Record<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  try {
    switch (name) {
      case 'read_file': {
        const full = abs(args['path']!);
        const MAX_BYTES = 50_000;
        const stat = await fs.stat(full);
        if (stat.size > MAX_BYTES) {
          const fh = await fs.open(full, 'r');
          try {
            const buf = Buffer.alloc(MAX_BYTES);
            await fh.read(buf, 0, MAX_BYTES, 0);
            return (
              buf.toString('utf-8') +
              `\n\n[file truncated — ${stat.size.toLocaleString()} bytes total, showing first ${MAX_BYTES.toLocaleString()}]`
            );
          } finally {
            await fh.close();
          }
        }
        return await fs.readFile(full, 'utf-8');
      }

      case 'write_file': {
        const full = abs(args['path']!);
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, args['content']!, 'utf-8');
        return `Written ${args['content']!.length} chars to ${args['path']}`;
      }

      case 'edit_file': {
        // #11 fix: replace ALL occurrences, not just the first
        const full = abs(args['path']!);
        const src  = await fs.readFile(full, 'utf-8');
        if (!src.includes(args['old_str']!)) {
          return `Error: exact string not found in ${args['path']}`;
        }
        const count   = src.split(args['old_str']!).length - 1;
        const updated = src.split(args['old_str']!).join(args['new_str']!);
        await fs.writeFile(full, updated, 'utf-8');
        return `Edited ${args['path']} (${count} occurrence${count !== 1 ? 's' : ''} replaced)`;
      }

      case 'list_dir': {
        const dir     = args['path'] ? abs(args['path']) : CWD;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries
          .map(e => `${e.isDirectory() ? 'd' : 'f'}  ${e.name}`)
          .join('\n');
      }

      case 'run_command': {
        // #4 fix: spawn instead of exec — no maxBuffer crash, rolling 100 KB cap
        return await spawnCollect('sh', ['-c', args['command']!], {
          cwd: CWD,
          timeout: 30_000,
          signal,
        });
      }

      case 'delete_file': {
        await fs.unlink(abs(args['path']!));
        return `Deleted ${args['path']}`;
      }

      case 'search_files': {
        // #3 fix: spawn with array args — pattern is never shell-interpreted
        const dir      = args['path'] ? abs(args['path']) : CWD;
        const grepArgs = ['-rn'];
        if (args['file_pattern']) grepArgs.push(`--include=${args['file_pattern']}`);
        grepArgs.push(args['pattern']!, dir);

        const out = await spawnCollect('grep', grepArgs, { cwd: CWD, signal });
        // Limit to first 50 lines
        return out.split('\n').slice(0, 50).join('\n') || '(no matches)';
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
