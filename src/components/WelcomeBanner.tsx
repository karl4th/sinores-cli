import React, { memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import os from 'os';
import { VERSION } from '../version.js';

function getDisplayName() {
  const raw = os.userInfo().username;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const RELEASE_DATE = 'May 20, 2026';

const RELEASE_NOTES = [
  'Agent mode with live file-system access',
  '/export saves full session as Markdown',
  'Context bar shows live token usage',
  'Tab cycles through keyboard hints',
];

const GEM_COLORS: Array<[string, string, string]> = [
  ['#C4B5FD', '#8B5CF6', '#C4B5FD'],
  ['#8B5CF6', '#A78BFA', '#8B5CF6'],
  ['#22D3EE', '#06B6D4', '#22D3EE'],
];
const GEM_CHARS = ['◈◆◈', '◆◈◆', '◈◆◈'];

function GemIcon() {
  return (
    <Box flexDirection="column">
      {GEM_CHARS.map((row, ri) => (
        <Box key={ri}>
          {row.split('').map((ch, ci) => (
            <Text key={ci} color={GEM_COLORS[ri]![ci]!}>{ch}</Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export const WelcomeBanner = memo(function WelcomeBanner() {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const W = cols - 2;
  const inner = W - 4;
  const leftW = Math.max(28, Math.floor(inner * 0.44));
  const rightW = inner - leftW - 3;
  const name = getDisplayName();

  const DIVIDER_H = Math.max(
    GEM_CHARS.length + 1,
    RELEASE_NOTES.length + 2,
  );

  return (
    <Box
      borderStyle="round"
      borderColor="#4C1D95"
      width={W}
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      marginBottom={1}
    >
      <Box flexDirection="row">
        <Box flexDirection="column" width={leftW}>
          <Box gap={2} alignItems="flex-start">
            <GemIcon />
            <Box flexDirection="column">
              <Text color="#EDE9FE" bold>Welcome back, {name}</Text>
              <Box gap={1}>
                <Text color="#8B5CF6" bold>sinores</Text>
                <Text color="#6B7280">v{VERSION}  ·  {today()}</Text>
              </Box>
              <Text color="#4B5563">released {RELEASE_DATE}</Text>
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column" paddingX={1}>
          {Array.from({ length: DIVIDER_H }).map((_, i) => (
            <Text key={i} color="#4B5563">│</Text>
          ))}
        </Box>

        <Box flexDirection="column" width={rightW}>
          <Text color="#9CA3AF" bold>What's new</Text>
          <Box marginTop={1} flexDirection="column">
            {RELEASE_NOTES.map((note, i) => (
              <Box key={i} gap={1}>
                <Text color="#7C3AED">◆</Text>
                <Text color="#6B7280">{note.slice(0, rightW - 4)}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});
