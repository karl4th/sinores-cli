import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { ChatMsg } from './ai.js';
import type { Message } from '../components/MessageBubble.js';

const SINORES_DIR   = path.join(os.homedir(), '.sinores');
const SESSIONS_DIR  = path.join(SINORES_DIR, 'sessions');
const CURRENT_FILE  = path.join(SINORES_DIR, 'current-session.json');

export interface SessionData {
  id:          string;
  name:        string;
  messages:    Message[];
  fullHistory: ChatMsg[];
  tokens:      number;
  createdAt:   string;
  updatedAt:   string;
}

export interface SessionMeta {
  id:            string;
  name:          string;
  createdAt:     string;
  updatedAt:     string;
  messagesCount: number;
  tokens:        number;
  preview:       string;
}

export async function ensureDirs() {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

function sessionPath(id: string) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function listSessions(): Promise<SessionMeta[]> {
  try {
    const files = await readdir(SESSIONS_DIR);
    const sessions: SessionMeta[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const id = f.slice(0, -5);
      try {
        const raw = await readFile(path.join(SESSIONS_DIR, f), 'utf-8');
        const data = JSON.parse(raw) as SessionData;
        // Skip empty sessions — no point restoring a blank chat
        if (data.messages.length === 0) continue;
        const firstUser = data.messages.find(m => m.role === 'user');
        sessions.push({
          id,
          name: data.name || id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          messagesCount: data.messages.length,
          tokens: data.tokens,
          preview: firstUser?.content.slice(0, 60).replace(/\n/g, ' ') || '',
        });
      } catch { /* skip corrupt */ }
    }
    return sessions.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  } catch {
    return [];
  }
}

export async function loadSession(id: string): Promise<SessionData | null> {
  try {
    const raw = await readFile(sessionPath(id), 'utf-8');
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function saveSession(data: SessionData): Promise<void> {
  try {
    await ensureDirs();
    const payload: SessionData = { ...data, updatedAt: new Date().toISOString() };
    await writeFile(sessionPath(data.id), JSON.stringify(payload, null, 0), 'utf-8');
    await writeFile(CURRENT_FILE, JSON.stringify({ current: data.id }), 'utf-8');
  } catch { /* non-fatal */ }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await unlink(sessionPath(id));
  } catch { /* non-fatal */ }
}

export async function getCurrentSessionId(): Promise<string | null> {
  try {
    const raw = await readFile(CURRENT_FILE, 'utf-8');
    const { current } = JSON.parse(raw);
    return current || null;
  } catch {
    return null;
  }
}

export async function clearCurrentSession(): Promise<void> {
  try {
    await writeFile(CURRENT_FILE, JSON.stringify({ current: null }), 'utf-8');
  } catch { /* non-fatal */ }
}
