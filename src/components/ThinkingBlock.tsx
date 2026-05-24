import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingBlockProps {
  tokens: number;
}

export function ThinkingBlock({ tokens }: ThinkingBlockProps) {
  return (
    <Box gap={2}>
      <Text color="#4C1D95">◈ thought for</Text>
      <Text color="#374151">{tokens.toLocaleString()} chars</Text>
    </Box>
  );
}
