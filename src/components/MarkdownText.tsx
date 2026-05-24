import React from 'react';
import { Box, Text } from 'ink';

// ── inline: renders **bold**, `code`, plain text ──────────────────────────────

function InlineText({ text, baseColor }: { text: string; baseColor: string }) {
  // Split on **bold** and `code` spans
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={i++} color={baseColor}>{text.slice(last, match.index)}</Text>);
    }
    const token = match[0]!;
    if (token.startsWith('**')) {
      parts.push(<Text key={i++} color="#E5E7EB" bold>{token.slice(2, -2)}</Text>);
    } else {
      parts.push(<Text key={i++} color="#A78BFA" backgroundColor="#1E1B4B"> {token.slice(1, -1)} </Text>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(<Text key={i++} color={baseColor}>{text.slice(last)}</Text>);
  }

  return <Text>{parts}</Text>;
}

// ── block renderer ────────────────────────────────────────────────────────────

export const MarkdownText = React.memo(function MarkdownText({ content, color = '#D1D5DB' }: { content: string; color?: string }) {
  const lines  = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // ── fenced code block ──
    if (line.trimStart().startsWith('```')) {
      const lang = line.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++; // skip closing ``` only if found
      blocks.push(
        <Box
          key={i}
          flexDirection="column"
          borderStyle="round"
          borderColor="#374151"
          paddingX={1}
          marginTop={0}
          marginBottom={0}
        >
          {lang && <Text color="#4B5563" dimColor>{lang}</Text>}
          {codeLines.map((cl, ci) => (
            <Text key={ci} color="#A78BFA">{cl}</Text>
          ))}
        </Box>,
      );
      continue;
    }

    // ── h1 / h2 / h3 ──
    if (line.startsWith('### ')) {
      blocks.push(<Text key={i} color="#C4B5FD" bold>{line.slice(4)}</Text>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(<Text key={i} color="#DDD6FE" bold>{line.slice(3)}</Text>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(<Text key={i} color="#EDE9FE" bold>{line.slice(2)}</Text>);
      i++; continue;
    }

    // ── bullet list ──
    if (/^[-*] /.test(line)) {
      blocks.push(
        <Box key={i} gap={1}>
          <Text color="#6D28D9">◆</Text>
          <InlineText text={line.slice(2)} baseColor={color} />
        </Box>,
      );
      i++; continue;
    }

    // ── numbered list ──
    const numM = line.match(/^(\d+)\. (.*)/);
    if (numM) {
      blocks.push(
        <Box key={i} gap={1}>
          <Text color="#6D28D9">{numM[1]}.</Text>
          <InlineText text={numM[2]!} baseColor={color} />
        </Box>,
      );
      i++; continue;
    }

    // ── blank line → small gap ──
    if (line.trim() === '') {
      blocks.push(<Text key={i}>{' '}</Text>);
      i++; continue;
    }

    // ── regular line ──
    blocks.push(
      <Box key={i}>
        <InlineText text={line} baseColor={color} />
      </Box>,
    );
    i++;
  }

  return <Box flexDirection="column">{blocks}</Box>;
});
