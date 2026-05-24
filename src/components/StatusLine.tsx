import React from 'react';
import { Box, Text } from 'ink';

const MODE_COLOR: Record<string, string> = {
  chat: '#06B6D4',
  agent: '#A78BFA',
  code: '#10B981',
  research: '#F59E0B',
};

export interface StatusLineProps {
  model: string;
  mode: string;
  tokens: number;
  contextPct: number;
}

export function StatusLine({ model, mode, tokens, contextPct }: StatusLineProps) {
  const modeColor = MODE_COLOR[mode] ?? '#9CA3AF';
  const ctxColor = contextPct > 80 ? '#EF4444' : contextPct > 60 ? '#F59E0B' : '#10B981';
  const tokLabel = tokens > 0 ? tokens.toLocaleString() + ' tok' : '0 tok';

  return (
    <Box paddingLeft={3} paddingTop={0}>
      <Text color="#8B5CF6" bold>◆</Text>
      <Text color="#4B5563">  {model}  ·  </Text>
      <Text color={modeColor}>{mode}</Text>
      <Text color="#4B5563">  ·  {tokLabel}  ·  ctx </Text>
      <Text color={ctxColor}>{contextPct}%</Text>
    </Box>
  );
}
