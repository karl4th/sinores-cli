import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { SessionMeta } from '../services/session.js';

interface Props {
  sessions: SessionMeta[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}

function displayName(s: SessionMeta): string {
  if (s.name && s.name !== s.id) return s.name;
  if (s.preview) return s.preview;
  return s.id;
}

export function ResumeSelector({ sessions, onSelect, onCancel }: Props) {
  const [index, setIndex] = useState(0);

  useInput((_ch, key) => {
    if (key.upArrow) {
      setIndex(i => (i <= 0 ? sessions.length - 1 : i - 1));
    } else if (key.downArrow) {
      setIndex(i => (i >= sessions.length - 1 ? 0 : i + 1));
    } else if (key.return) {
      onSelect(sessions[index].id);
    } else if (key.escape || _ch === 'q') {
      onCancel();
    }
  });

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        <Text color="#F59E0B">No saved sessions found.</Text>
        <Text color="#4B5563">Press q to cancel.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={1}>
      <Text color="#8B5CF6" bold>Saved sessions — choose one:</Text>
      <Box flexDirection="column" marginTop={1}>
        {sessions.map((s, i) => {
          const active = i === index;
          const date = new Date(s.updatedAt).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' });
          const label = displayName(s).slice(0, 50);
          return (
            <Box key={s.id} flexDirection="column" marginBottom={1}>
              <Box gap={1}>
                <Text color={active ? '#06B6D4' : '#4B5563'}>{active ? '▸' : ' '}</Text>
                <Text color={active ? '#E5E7EB' : '#9CA3AF'} bold={active}>
                  {label}
                </Text>
                <Text color="#4B5563">· {s.messagesCount} msgs · {s.tokens.toLocaleString()} tok · {date}</Text>
              </Box>
              {s.preview && label !== s.preview && (
                <Box paddingLeft={2}>
                  <Text color="#4B5563" dimColor>{s.preview.slice(0, 70)}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="#4B5563">↑↓ navigate · Enter select · q cancel</Text>
      </Box>
    </Box>
  );
}
