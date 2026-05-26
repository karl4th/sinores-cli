import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import { readdir } from 'fs/promises';
import path from 'path';
import { CWD } from '../services/tools.js';

interface InputAreaProps {
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  exitPending?: boolean;
  initialValue?: string;
}

const COMMANDS: Array<{ name: string; desc: string }> = [
  { name: '/help', desc: 'Show available commands' },
  { name: '/goal', desc: 'Set a goal and execute step by step' },
  { name: '/compact', desc: 'Compact conversation history to save context space' },
  { name: '/init', desc: 'Scan project and create .sinores/SINORES.md' },
  { name: '/mode', desc: 'Switch mode (chat, agent, code, research)' },
  { name: '/model', desc: 'Select AI provider and model' },
  { name: '/settings', desc: 'Edit config (API keys, provider, model, etc.)' },
  { name: '/export', desc: 'Save session to Markdown file' },
  { name: '/resume', desc: 'Restore previous session from disk' },
  { name: '/new', desc: 'Start a new session' },
  { name: '/clear', desc: 'Reset conversation (requires confirmation)' },
];

const HINTS = [
  '↑↓ history   Tab autocomplete   Ctrl+C exit   @file context',
  '/help  /goal  /compact  /init  /export  /resume  /new  /clear',
  '/init generates project context   /export saves session   /resume restores',
];

function matchingCommands(value: string): Array<{ name: string; desc: string }> {
  if (!value) return COMMANDS;
  if (!value.startsWith('/')) return [];
  return COMMANDS.filter(c => c.name.startsWith(value) && c.name !== value);
}

async function scanFiles(dir: string, depth = 0, maxDepth = 2): Promise<string[]> {
  if (depth > maxDepth) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env') continue;
      if (['node_modules', 'dist', 'build', '.sinores', 'coverage', '__pycache__', '.next'].includes(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        files.push(...await scanFiles(full, depth + 1, maxDepth));
      } else {
        files.push(path.relative(CWD, full));
      }
    }
    return files;
  } catch {
    return [];
  }
}

function extractAtQuery(value: string): { before: string; query: string } | null {
  const match = value.match(/@([^\s]*)$/);
  if (!match) return null;
  const idx = match.index!;
  // Only trigger when @ is at the start or preceded by whitespace (not inside email addresses)
  if (idx > 0 && !/\s/.test(value[idx - 1]!)) return null;
  return { before: value.slice(0, idx), query: match[1] ?? '' };
}

export const InputArea = memo(function InputArea({ onSubmit, isLoading = false, exitPending = false, initialValue }: InputAreaProps) {
  const { stdout } = useStdout();
  const W = (stdout?.columns ?? 80) - 2;

  const [value, setValue] = useState(initialValue ?? '');
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    if (initialValue !== undefined && initialValue !== initialValueRef.current) {
      initialValueRef.current = initialValue;
      setValue(initialValue);
    }
  }, [initialValue]);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [saved, setSaved] = useState('');
  const [hintIdx, setHintIdx] = useState(0);

  const [files, setFiles] = useState<string[]>([]);
  const [fileIndex, setFileIndex] = useState(0);
  const [inputKey, setInputKey] = useState(0);

  const cmdHints = matchingCommands(value);
  const atQuery = extractAtQuery(value);
  const filePickerOpen = atQuery !== null && !isLoading;

  const filteredFiles = filePickerOpen
    ? files.filter(f => f.toLowerCase().includes(atQuery.query.toLowerCase()))
    : [];

  useEffect(() => {
    if (filePickerOpen && files.length === 0) {
      scanFiles(CWD).then(setFiles).catch(() => setFiles([]));
    }
  }, [filePickerOpen, files.length]);

  useEffect(() => {
    if (filePickerOpen) {
      setFileIndex(0);
    }
  }, [atQuery?.query, filePickerOpen]);

  const insertValue = useCallback((newValue: string) => {
    setValue(newValue);
    setInputKey(k => k + 1);
  }, []);

  const insertFile = useCallback((filepath: string) => {
    if (!atQuery) return;
    insertValue(atQuery.before + '@' + filepath + ' ');
  }, [atQuery, insertValue]);

  useInput((_ch, key) => {
    if (isLoading) return;

    if (key.escape) {
      if (filePickerOpen) {
        setValue(atQuery.before + '@' + atQuery.query);
      }
      return;
    }

    if (filePickerOpen) {
      if (key.upArrow) {
        setFileIndex(i => (i <= 0 ? filteredFiles.length - 1 : i - 1));
        return;
      }
      if (key.downArrow) {
        setFileIndex(i => (i >= filteredFiles.length - 1 ? 0 : i + 1));
        return;
      }
      if (key.return && filteredFiles.length > 0) {
        insertFile(filteredFiles[fileIndex] ?? filteredFiles[0]!);
        return;
      }
    }

    if (key.tab) {
      if (!value || cmdHints.length === 0) {
        setHintIdx(h => (h + 1) % HINTS.length);
      } else if (cmdHints.length > 0) {
        insertValue(cmdHints[0]!.name);
      } else {
        setHintIdx(h => (h + 1) % HINTS.length);
      }
      return;
    }

    if (!filePickerOpen && key.return) {
      handleSubmit(value);
      return;
    }

    if (!filePickerOpen) {
      if (key.upArrow) {
        if (history.length === 0) return;
        if (histIdx === -1) setSaved(value);
        const next = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(next);
        setValue(history[next] ?? '');
        return;
      }

      if (key.downArrow) {
        if (histIdx === -1) return;
        const next = histIdx - 1;
        if (next === -1) {
          setHistIdx(-1);
          setValue(saved);
        } else {
          setHistIdx(next);
          setValue(history[next] ?? '');
        }
        return;
      }
    }
  });

  const handleSubmit = (val: string) => {
    if (!val.trim()) return;
    setHistory(prev => [val.trim(), ...prev]);
    setHistIdx(-1);
    setSaved('');
    onSubmit(val.trim());
    setValue('');
  };

  const isCmd = value.startsWith('/');
  const promptChar = isLoading ? '◌' : isCmd ? '/' : '▸';
  const promptColor = isLoading ? '#374151' : isCmd ? '#F59E0B' : '#8B5CF6';
  const borderColor = isLoading ? '#1F2937' : isCmd ? '#78350F' : '#4C1D95';

  return (
    <Box flexDirection="column">
      {filePickerOpen && (
        <Box flexDirection="column" paddingLeft={3} paddingBottom={0}>
          <Text color="#6B7280">files: {files.length === 0 ? 'scanning…' : filteredFiles.length === 0 ? 'no matches' : ''}</Text>
          <Box flexDirection="column">
            {filteredFiles.slice(0, 6).map((f, i) => (
              <Text key={f} color={i === fileIndex ? '#C4B5FD' : '#6B7280'} bold={i === fileIndex}>
                {i === fileIndex ? '▸ ' : '  '}{f}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {cmdHints.length > 0 && !filePickerOpen && (
        <Box paddingLeft={3} paddingBottom={0} flexDirection="column">
          <Text color="#6B7280">commands:</Text>
          {cmdHints.map((cmd, i) => (
            <Text key={cmd.name} color={i === 0 ? '#C4B5FD' : '#6B7280'} bold={i === 0}>
              {i === 0 ? '▸ ' : '  '}{cmd.name} <Text color="#6B7280">— {cmd.desc}</Text>
            </Text>
          ))}
        </Box>
      )}

      <Box
        borderStyle="round"
        borderColor={borderColor}
        width={W}
        paddingX={1}
      >
        <Text color={promptColor} bold>{promptChar}  </Text>
        {isLoading ? (
          <Text color="#4B5563" italic>sinores is thinking…</Text>
        ) : (
          <TextInput
            key={inputKey}
            value={value}
            onChange={setValue}
            placeholder="Message sinores"
          />
        )}
      </Box>

      <Box paddingLeft={3}>
        {exitPending ? (
          <Text color="#EF4444">Press Ctrl+C again to exit</Text>
        ) : (
          <Text color="#6B7280">{HINTS[hintIdx]}</Text>
        )}
      </Box>
    </Box>
  );
});
