import { readFileSync, existsSync } from 'fs';
import path from 'path';

const MEMORY_PATH = path.join(process.cwd(), '.sinores', 'MEMORY.md');

export function loadMemory(): string | null {
  if (!existsSync(MEMORY_PATH)) return null;
  try {
    const content = readFileSync(MEMORY_PATH, 'utf-8').trim();
    return content || null;
  } catch {
    return null;
  }
}
