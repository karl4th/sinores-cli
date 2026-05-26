import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { PROVIDER_CONFIG, type Provider } from '../services/config.js';

interface Props {
  currentProvider: Provider;
  currentModel: string;
  onSelect: (provider: Provider, model: string) => void;
  onCancel: () => void;
}

export function ModelSelector({ currentProvider, currentModel, onSelect, onCancel }: Props) {
  const [provider, setProvider] = useState<Provider>(currentProvider);
  const providers = Object.keys(PROVIDER_CONFIG) as Provider[];
  const [pIdx, setPIdx] = useState(providers.indexOf(currentProvider));
  const models = PROVIDER_CONFIG[provider].models;
  const [mIdx, setMIdx] = useState(Math.max(0, models.indexOf(currentModel)));
  const [phase, setPhase] = useState<'provider' | 'model'>('provider');

  useInput((_ch, key) => {
    if (phase === 'provider') {
      if (key.upArrow || key.leftArrow) {
        setPIdx(i => {
          const ni = i <= 0 ? providers.length - 1 : i - 1;
          setProvider(providers[ni]!);
          return ni;
        });
      } else if (key.downArrow || key.rightArrow) {
        setPIdx(i => {
          const ni = i >= providers.length - 1 ? 0 : i + 1;
          setProvider(providers[ni]!);
          return ni;
        });
      } else if (key.return) {
        const p = providers[pIdx]!;
        setProvider(p);
        const newModels = PROVIDER_CONFIG[p].models;
        const newMIdx = Math.max(0, newModels.indexOf(PROVIDER_CONFIG[p].defaultModel));
        setMIdx(newMIdx);
        setPhase('model');
      } else if (key.escape || _ch === 'q') {
        onCancel();
      }
    } else {
      const currentModels = PROVIDER_CONFIG[provider].models;
      if (key.upArrow || key.leftArrow) {
        setMIdx(i => (i <= 0 ? currentModels.length - 1 : i - 1));
      } else if (key.downArrow || key.rightArrow) {
        setMIdx(i => (i >= currentModels.length - 1 ? 0 : i + 1));
      } else if (key.return) {
        onSelect(provider, currentModels[mIdx]!);
      } else if (key.escape || _ch === 'q') {
        setPhase('provider');
      }
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={1}>
      <Text color="#8B5CF6" bold>Select model</Text>
      <Box flexDirection="column" marginTop={1}>
        {phase === 'provider' ? (
          <>
            <Text color="#6B7280">Provider:</Text>
            {providers.map((p, i) => (
              <Box key={p} gap={1}>
                <Text color={i === pIdx ? '#06B6D4' : '#4B5563'}>{i === pIdx ? '▸' : ' '}</Text>
                <Text color={i === pIdx ? '#E5E7EB' : '#9CA3AF'} bold={i === pIdx}>
                  {p}
                </Text>
              </Box>
            ))}
            <Box marginTop={1}>
              <Text color="#4B5563">↑↓ select · Enter confirm · q cancel</Text>
            </Box>
          </>
        ) : (
          <>
            <Text color="#6B7280">Provider: <Text color="#E5E7EB">{provider}</Text></Text>
            <Box marginTop={1}>
              <Text color="#6B7280">Model:</Text>
            </Box>
            {models.map((mod, i) => (
              <Box key={mod} gap={1}>
                <Text color={i === mIdx ? '#06B6D4' : '#4B5563'}>{i === mIdx ? '▸' : ' '}</Text>
                <Text color={i === mIdx ? '#E5E7EB' : '#9CA3AF'} bold={i === mIdx}>
                  {mod}
                </Text>
                {mod === PROVIDER_CONFIG[provider].defaultModel && (
                  <Text color="#4B5563">(default)</Text>
                )}
              </Box>
            ))}
            <Box marginTop={1}>
              <Text color="#4B5563">↑↓ select · Enter confirm · ESC back · q cancel</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
