import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { saveConfig } from '../services/config.js';

interface SetupScreenProps {
  onComplete: (apiKey: string) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const { exit } = useApp();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (val: string) => {
    const key = val.trim();
    if (!key) {
      setError('API key cannot be empty. Get one at platform.moonshot.cn');
      return;
    }
    saveConfig({ moonshotApiKey: key });
    onComplete(key);
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      <Text bold color="#8B5CF6">sinores setup</Text>
      <Text color="#9CA3AF">
        Moonshot API key is required. Get one at <Text color="#C4B5FD">platform.moonshot.cn</Text>
      </Text>

      <Box
        borderStyle="round"
        borderColor="#4C1D95"
        paddingX={1}
        marginTop={1}
      >
        <Text color="#8B5CF6" bold>▸  </Text>
        <TextInput
          value={value}
          onChange={val => { setValue(val); setError(''); }}
          onSubmit={handleSubmit}
          placeholder="sk-..."
          mask="*"
        />
      </Box>

      {error ? (
        <Text color="#EF4444">{error}</Text>
      ) : (
        <Text color="#6B7280">Press Enter to save and continue · Ctrl+C to exit</Text>
      )}
    </Box>
  );
}
