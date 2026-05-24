import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { describeCall, type ToolName } from '../services/tools.js';
import type { Permission } from '../services/ai.js';

interface Props {
  toolName:  ToolName;
  args:      Record<string, string>;
  onDecide:  (p: Permission) => void;
}

function sessionLabel(toolName: ToolName): string {
  if (toolName === 'run_command') return 'Allow this command in session';
  return `Allow all ${toolName.replace('_', ' ')}s in session`;
}

const TOOL_TAG: Record<ToolName, string> = {
  read_file:    '[read]',
  write_file:   '[write]',
  edit_file:    '[edit]',
  list_dir:     '[list]',
  run_command:  '[run]',
  delete_file:  '[del]',
  search_files: '[grep]',
};

const OPTIONS: Permission[] = ['once', 'session', 'cancel'];

export function PermissionDialog({ toolName, args, onDecide }: Props) {
  const { stdout } = useStdout();
  const W = (stdout?.columns ?? 80) - 2;
  const [sel, setSel] = useState(0);

  useInput((_ch, key) => {
    if (_ch === '1') { onDecide('once'); return; }
    if (_ch === '2') { onDecide('session'); return; }
    if (_ch === '3' || key.escape) { onDecide('cancel'); return; }
    if (key.leftArrow || key.upArrow) { setSel(s => (s + 2) % 3); return; }
    if (key.rightArrow || key.downArrow) { setSel(s => (s + 1) % 3); return; }
    if (key.return) { onDecide(OPTIONS[sel]!); return; }
  });

  const tag   = TOOL_TAG[toolName] ?? '[tool]';
  const label = describeCall(toolName, args);

  const opts = [
    { key: '1', label: 'Allow once',          permission: 'once' as Permission,    color: '#A78BFA' },
    { key: '2', label: sessionLabel(toolName), permission: 'session' as Permission, color: '#A78BFA' },
    { key: '3', label: 'Cancel',               permission: 'cancel' as Permission,  color: '#EF4444' },
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#7C3AED"
      width={W}
      paddingX={2}
      paddingY={0}
      marginBottom={1}
    >
      <Box gap={2}>
        <Text color="#8B5CF6" bold>◆ sinores</Text>
        <Text color="#6B7280">wants to perform an action</Text>
      </Box>

      <Box gap={2} paddingLeft={2}>
        <Text color="#A78BFA" bold>{tag}</Text>
        <Text color="#E5E7EB">{label}</Text>
      </Box>

      <Box gap={4} paddingLeft={2} marginTop={1}>
        {opts.map((opt, i) => {
          const active = sel === i;
          return (
            <Box key={opt.key} gap={1}>
              <Text color={active ? opt.color : '#4B5563'} bold={active}>
                {active ? '▸' : ' '}{opt.key}
              </Text>
              <Text color={active ? '#E5E7EB' : '#6B7280'} bold={active}>
                {opt.label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box paddingLeft={2} marginTop={0}>
        <Text color="#374151" dimColor>←→ navigate · Enter confirm · 1/2/3 direct</Text>
      </Box>
    </Box>
  );
}
