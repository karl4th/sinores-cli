import React, { memo } from 'react';
import { Box, Text, useStdout } from 'ink';

interface Props {
  liveContent?: string;
  liveThinkingText?: string;
  liveThinkingChars?: number;
}

export const ThinkingIndicator = memo(function ThinkingIndicator({
  liveContent = '',
  liveThinkingText = '',
  liveThinkingChars = 0,
}: Props) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const blockW = cols - 4;

  const isThinking = liveThinkingText.length > 0;
  const isAnswering = liveContent.length > 0;

  return (
    <Box flexDirection="column" paddingLeft={1} marginBottom={1}>
      <Box gap={2} marginBottom={0}>
        <Text color="#8B5CF6" bold>◆ sinores</Text>
        <Text color="#6B7280" italic>
          {isAnswering ? 'responding…' : 'reasoning…'}
        </Text>
        {liveThinkingChars > 0 && (
          <Text color="#4B5563">{liveThinkingChars.toLocaleString()} chars</Text>
        )}
      </Box>

      {(isThinking || !isAnswering) && (
        <Box
          paddingLeft={2}
          flexDirection="column"
          borderStyle="round"
          borderColor="#4C1D95"
          width={blockW}
          paddingX={2}
          paddingY={1}
        >
          {isThinking ? (
            <Text color="#6B7280" wrap="wrap">
              {liveThinkingText.split('\n').slice(-5).join('\n')}
              <Text color="#8B5CF6">▌</Text>
            </Text>
          ) : (
            <Text color="#6B7280" italic>Working on it…</Text>
          )}
        </Box>
      )}

      {isAnswering && (
        <Box paddingLeft={3} marginTop={1} flexDirection="column">
          <Text color="#F9FAFB" wrap="wrap">{liveContent}</Text>
          <Text color="#8B5CF6">▌</Text>
        </Box>
      )}
    </Box>
  );
});
