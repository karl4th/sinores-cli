import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { VERSION } from '../version.js';

// 13-row diamond: n = diamonds per row, color = gradient violet→cyan
const GEM_ROWS = [
  { n: 1,  color: '#FFFFFF' },
  { n: 3,  color: '#F5F3FF' },
  { n: 5,  color: '#EDE9FE' },
  { n: 7,  color: '#DDD6FE' },
  { n: 9,  color: '#C4B5FD' },
  { n: 11, color: '#A78BFA' },
  { n: 13, color: '#8B5CF6' },
  { n: 11, color: '#7C3AED' },
  { n: 9,  color: '#6D28D9' },
  { n: 7,  color: '#4F46E5' },
  { n: 5,  color: '#22D3EE' },
  { n: 3,  color: '#06B6D4' },
  { n: 1,  color: '#0284C7' },
];

const TAGLINE = 'intelligent terminal companion';
const NAME    = 'sinores';

function gemRow(n: number): string {
  const pad = (13 - n) / 2;
  return ' '.repeat(pad) + '◆'.repeat(n) + ' '.repeat(pad);
}

interface SplashProps {
  onDone: () => void;
}

export function Splash({ onDone }: SplashProps) {
  const { exit } = useApp();
  const [visibleRows,  setVisibleRows]  = useState(0);
  const [showName,     setShowName]     = useState(false);
  const [taglineChars, setTaglineChars] = useState(0);
  const [finished,     setFinished]     = useState(false);

  const finish = useCallback(() => {
    if (!finished) { setFinished(true); onDone(); }
  }, [finished, onDone]);

  // Ctrl+C exits immediately; any other key skips the animation
  useInput((_ch, key) => {
    if (key.ctrl && _ch === 'c') exit();
    else finish();
  });

  // Row-by-row gem assembly
  useEffect(() => {
    if (visibleRows >= GEM_ROWS.length) {
      const t = setTimeout(() => setShowName(true), 180);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleRows(v => v + 1), 55);
    return () => clearTimeout(t);
  }, [visibleRows]);

  // Typewriter tagline
  useEffect(() => {
    if (!showName) return;
    if (taglineChars >= TAGLINE.length) {
      const t = setTimeout(finish, 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTaglineChars(c => c + 1), 28);
    return () => clearTimeout(t);
  }, [showName, taglineChars, finish]);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      paddingTop={3}
      paddingBottom={2}
    >
      {/* Gem */}
      <Box flexDirection="column" alignItems="center">
        {GEM_ROWS.slice(0, visibleRows).map((row, i) => (
          <Text key={i} color={row.color}>
            {gemRow(row.n)}
          </Text>
        ))}
      </Box>

      {/* Name + tagline */}
      {showName && (
        <Box flexDirection="column" alignItems="center" marginTop={2} gap={0}>
          <Box gap={2} alignItems="center">
            <Text color="#A78BFA" bold>{NAME}</Text>
            <Text color="#4B5563">v{VERSION}</Text>
          </Box>
          <Text color="#6B7280">
            {TAGLINE.slice(0, taglineChars)}
            {taglineChars < TAGLINE.length
              ? <Text color="#A78BFA">▌</Text>
              : null}
          </Text>
        </Box>
      )}

      {/* Skip hint */}
      {visibleRows > 0 && (
        <Box marginTop={3}>
          <Text color="#374151" dimColor>press any key to skip</Text>
        </Box>
      )}
    </Box>
  );
}
