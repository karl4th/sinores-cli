import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  PROVIDER_CONFIG,
  type Provider,
  type Config,
  saveConfig,
  getConfig,
} from '../services/config.js';

type FieldDef =
  | { key: 'provider'; label: string; type: 'select'; options: Provider[] }
  | { key: 'model'; label: string; type: 'select'; options: string[] }
  | { key: 'moonshotApiKey'; label: string; type: 'password' }
  | { key: 'deepseekApiKey'; label: string; type: 'password' }
  | { key: 'maxRounds'; label: string; type: 'number' };

const ALL_FIELDS: FieldDef[] = [
  { key: 'provider', label: 'Provider', type: 'select', options: Object.keys(PROVIDER_CONFIG) as Provider[] },
  { key: 'model', label: 'Model', type: 'select', options: [] }, // filled dynamically
  { key: 'moonshotApiKey', label: 'Moonshot API Key', type: 'password' },
  { key: 'deepseekApiKey', label: 'DeepSeek API Key', type: 'password' },
  { key: 'maxRounds', label: 'Max Rounds', type: 'number' },
];

function buildFields(cfg: Config): FieldDef[] {
  const provider = cfg.provider ?? 'moonshot';
  return ALL_FIELDS.map(f => {
    if (f.key === 'model') {
      return { ...f, options: PROVIDER_CONFIG[provider].models };
    }
    return f;
  });
}

function getValue(cfg: Config, key: FieldDef['key']): string {
  switch (key) {
    case 'provider': return cfg.provider ?? 'moonshot';
    case 'model': return cfg.model ?? PROVIDER_CONFIG[(cfg.provider ?? 'moonshot')].defaultModel;
    case 'moonshotApiKey': return cfg.moonshotApiKey ?? '';
    case 'deepseekApiKey': return cfg.deepseekApiKey ?? '';
    case 'maxRounds': return String(cfg.maxRounds ?? 50);
  }
}

function setValue(cfg: Config, key: FieldDef['key'], value: string): Config {
  const next = { ...cfg };
  switch (key) {
    case 'provider':
      next.provider = value as Provider;
      next.model = PROVIDER_CONFIG[next.provider].defaultModel;
      break;
    case 'model':
      next.model = value;
      break;
    case 'moonshotApiKey':
      next.moonshotApiKey = value;
      break;
    case 'deepseekApiKey':
      next.deepseekApiKey = value;
      break;
    case 'maxRounds': {
      const n = parseInt(value, 10);
      next.maxRounds = isNaN(n) ? 50 : Math.max(1, n);
      break;
    }
  }
  return next;
}

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export function SettingsScreen({ onDone, onCancel }: Props) {
  const [cfg, setCfg] = useState<Config>(() => ({ ...getConfig() }));
  const [fields, setFields] = useState<FieldDef[]>(() => buildFields(getConfig()));
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const refreshFields = useCallback((newCfg: Config) => {
    setFields(buildFields(newCfg));
  }, []);

  const currentField = fields[active];
  const isSelect = currentField?.type === 'select';

  useInput((_ch, key) => {
    if (editing) {
      if (key.escape) {
        setEditing(false);
        setEditValue('');
        return;
      }
      if (key.return) {
        const next = setValue(cfg, currentField!.key, editValue);
        setCfg(next);
        refreshFields(next);
        setEditing(false);
        setEditValue('');
        return;
      }
      return; // let TextInput handle typing
    }

    if (key.upArrow) {
      setActive(i => (i <= 0 ? fields.length - 1 : i - 1));
      return;
    }
    if (key.downArrow) {
      setActive(i => (i >= fields.length - 1 ? 0 : i + 1));
      return;
    }

    if (isSelect) {
      const opts = (currentField as Extract<FieldDef, { type: 'select' }>).options;
      const curVal = getValue(cfg, currentField.key);
      const curIdx = opts.indexOf(curVal as any);
      if (key.leftArrow) {
        const nextIdx = curIdx <= 0 ? opts.length - 1 : curIdx - 1;
        const next = setValue(cfg, currentField.key, opts[nextIdx]! as any);
        setCfg(next);
        refreshFields(next);
        return;
      }
      if (key.rightArrow) {
        const nextIdx = curIdx >= opts.length - 1 ? 0 : curIdx + 1;
        const next = setValue(cfg, currentField.key, opts[nextIdx]! as any);
        setCfg(next);
        refreshFields(next);
        return;
      }
    }

    if (key.return && !isSelect) {
      setEditValue(getValue(cfg, currentField!.key));
      setEditing(true);
      return;
    }

    if (_ch === 's' || _ch === 'S') {
      saveConfig(cfg);
      onDone();
      return;
    }

    if (key.escape || _ch === 'q') {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={1}>
      <Text color="#8B5CF6" bold>Settings</Text>
      <Text color="#6B7280">~/.sinores/config.json</Text>
      <Box flexDirection="column" marginTop={1} gap={1}>
        {fields.map((f, i) => {
          const isActive = i === active;
          const val = getValue(cfg, f.key);
          const masked = f.type === 'password' && val ? '•'.repeat(Math.min(val.length, 24)) : val;
          return (
            <Box key={f.key} flexDirection="column">
              <Box gap={1}>
                <Text color={isActive ? '#06B6D4' : '#4B5563'}>{isActive ? '▸' : ' '}</Text>
                <Text color={isActive ? '#E5E7EB' : '#9CA3AF'} bold={isActive}>
                  {f.label}
                </Text>
                {isActive && isSelect && (
                  <Text color="#4B5563">← → change</Text>
                )}
                {isActive && !isSelect && !editing && (
                  <Text color="#4B5563">Enter edit</Text>
                )}
              </Box>
              <Box paddingLeft={2}>
                {isActive && editing && f.type !== 'select' ? (
                  <Box>
                    <Text color="#C4B5FD">› </Text>
                    <TextInput
                      value={editValue}
                      onChange={setEditValue}
                      mask={f.type === 'password' ? '*' : undefined}
                    />
                  </Box>
                ) : (
                  <Text color="#9CA3AF" dimColor={!val}>
                    {masked || '(not set)'}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="#4B5563">↑↓ navigate · ←→ change select · Enter edit text · s save · q cancel</Text>
        {editing && (
          <Text color="#4B5563">ESC cancel edit · Enter confirm</Text>
        )}
      </Box>
    </Box>
  );
}
