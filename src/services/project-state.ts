import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CWD } from './tools.js';

const DB_DIR = path.join(CWD, '.sinores');
const DB_PATH = path.join(DB_DIR, 'state.db');

type DB = InstanceType<typeof BetterSqlite3>;

let db: DB | null = null;

function initSchema(database: DB) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      tool_name TEXT NOT NULL,
      tool_args TEXT,
      result_summary TEXT,
      timestamp INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS file_sigs (
      path TEXT PRIMARY KEY,
      mtime INTEGER,
      size INTEGER,
      hash TEXT
    );
  `);
}

export function getProjectDB(): DB {
  if (db) return db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new BetterSqlite3(DB_PATH);
  initSchema(db);
  return db;
}

export function logDecision(
  sessionId: string | null,
  toolName: string,
  toolArgs: Record<string, string>,
  result: string,
): void {
  try {
    const database = getProjectDB();
    const stmt = database.prepare(
      `INSERT INTO decisions (session_id, tool_name, tool_args, result_summary, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(
      sessionId ?? '',
      toolName,
      JSON.stringify(toolArgs),
      result.slice(0, 500),
      Math.floor(Date.now() / 1000)
    );
  } catch {
    // non-fatal
  }
}

export function closeProjectDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
