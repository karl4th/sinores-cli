import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { describeCall, type ToolName } from '../services/tools.js';
import type { ToolCallState } from '../services/ai.js';

const STATUS_ICON: Record<ToolCallState['status'], string> = {
  waiting:   '·',
  running:   '⟳',
  done:      '✓',
  cancelled: '⊘',
  error:     '✗',
};

const STATUS_COLOR: Record<ToolCallState['status'], string> = {
  waiting:   '#374151',
  running:   '#8B5CF6',
  done:      '#10B981',
  cancelled: '#6B7280',
  error:     '#EF4444',
};

function resultSummary(tc: ToolCallState): string | null {
  if (!tc.result || tc.status === 'cancelled') return null;
  if (tc.status === 'error') return tc.result.slice(0, 80);

  const r = tc.result;
  const lines = r.split('\n');

  switch (tc.name) {
    case 'read_file':
      return `${lines.length} lines, ${r.length} chars`;
    case 'write_file':
    case 'edit_file':
    case 'delete_file':
      return lines[0]?.slice(0, 60) ?? null;
    case 'run_command':
      return lines.find(l => l.trim())?.slice(0, 80) ?? '(no output)';
    case 'list_dir':
      return `${lines.length} entries`;
    case 'search_files':
      return lines.length === 1 && lines[0] === '(no matches)'
        ? '(no matches)'
        : `${Math.min(lines.length, 50)} matches`;
    default:
      return r.slice(0, 60);
  }
}

export const ToolCallBlock = memo(function ToolCallBlock({ tc }: { tc: ToolCallState }) {
  const icon = STATUS_ICON[tc.status];
  const color = STATUS_COLOR[tc.status];
  const label = describeCall(tc.name as ToolName, tc.args);
  const summary = resultSummary(tc);

  return (
    <Box gap={2} paddingLeft={4} marginBottom={0}>
      <Text color={color}>{icon}</Text>
      <Text color={color}>{label}</Text>
      {summary && (
        <Text color="#374151" dimColor>{summary}</Text>
      )}
    </Box>
  );
});
