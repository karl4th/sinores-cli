import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR  = path.join(os.homedir(), '.sinores');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export type Provider = 'moonshot' | 'deepseek';

export const PROVIDER_CONFIG: Record<Provider, { baseURL: string; defaultModel: string; models: string[] }> = {
  moonshot: {
    baseURL: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2.6',
    models: ['kimi-k2.6'],
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
};

export interface Config {
  provider?:       Provider;
  model?:          string;
  moonshotApiKey?: string;
  deepseekApiKey?: string;
  maxRounds?:      number;
  theme?:          string;
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

export function getProvider(): Provider {
  const cfg = getConfig();
  const env = process.env.SINORES_PROVIDER as Provider | undefined;
  if (env && env in PROVIDER_CONFIG) return env;
  return cfg.provider ?? 'moonshot';
}

export function getModel(): string {
  const cfg = getConfig();
  const provider = getProvider();
  const envModel = process.env.SINORES_MODEL;
  if (envModel) return envModel;
  if (cfg.model) return cfg.model;
  return PROVIDER_CONFIG[provider].defaultModel;
}

export function getApiKey(): string | undefined {
  const provider = getProvider();
  const envKey = process.env[provider === 'moonshot' ? 'MOONSHOT_API_KEY' : 'DEEPSEEK_API_KEY'];
  if (envKey) return envKey;

  const cfg = getConfig();
  return provider === 'moonshot' ? cfg.moonshotApiKey : cfg.deepseekApiKey;
}

export function getBaseURL(): string {
  return PROVIDER_CONFIG[getProvider()].baseURL;
}

export function getMaxRounds(): number {
  return getConfig().maxRounds ?? 50;
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
      provider: 'moonshot',
      model: 'kimi-k2.6',
      moonshotApiKey: process.env.MOONSHOT_API_KEY || '',
      deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
      maxRounds: 50,
    });
  }
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}
