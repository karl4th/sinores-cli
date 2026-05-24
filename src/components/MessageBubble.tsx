import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingTokens?: number;
  timestamp?: string;
}

export const MessageBubble = React.memo(function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'system') {
    return (
      <Box marginBottom={1} paddingLeft={2}>
        <Text color="#4B5563" italic>⚙  {message.content}</Text>
      </Box>
    );
  }

  const isUser = message.role === 'user';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* header */}
      <Box gap={1} marginBottom={0}>
        <Text color={isUser ? '#06B6D4' : '#8B5CF6'} bold>
          {isUser ? '▸ you' : '◆ sinores'}
        </Text>
        {!isUser && (message.thinkingTokens ?? 0) > 0 && (
          <Text color="#4C1D95" dimColor>· {message.thinkingTokens!.toLocaleString()} chars</Text>
        )}
      </Box>

      {/* content with left stripe */}
      <Box flexDirection="row">
        <Box paddingRight={1} flexShrink={0}>
          <Text color={isUser ? '#374151' : '#4C1D95'}>│</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {isUser ? (
            <Text color="#D1D5DB" wrap="wrap">{message.content}</Text>
          ) : (
            <MarkdownText content={message.content} />
          )}
        </Box>
      </Box>
    </Box>
  );
});
