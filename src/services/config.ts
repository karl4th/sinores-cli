import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config'; // backward compat: still load .env from cwd if present

const CONFIG_DIR  = path.join(os.homedir(), '.sinores');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export interface Config {
  moonshotApiKey?: string;
  defaultModel?:  string;
  maxRounds?:     number;
  theme?:         string;
}

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;

  const config: Config = {};

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Config;
      Object.assign(config, parsed);
    } catch {
      // corrupt config — ignore, will use defaults/env
    }
  }

  cached = config;
  return config;
}

export function getConfig(): Config {
  return loadConfig();
}

export function getMoonshotApiKey(): string | undefined {
  // Priority: process.env > ~/.sinores/config.json > undefined
  return process.env.MOONSHOT_API_KEY || getConfig().moonshotApiKey;
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  cached = config;
}

export function initConfig(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(CONFIG_PATH)) {
    saveConfig({
      moonshotApiKey: process.env.MOONSHOT_API_KEY || '',
      defaultModel: 'kimi-k2.6',
      maxRounds: 50,
    });
  }
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}
