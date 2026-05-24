import React from 'react';
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

// #22 fix: ASCII tags instead of emoji — predictable 1-column width
const TOOL_TAG: Record<ToolName, string> = {
  read_file:    '[read]',
  write_file:   '[write]',
  edit_file:    '[edit]',
  list_dir:     '[list]',
  run_command:  '[run]',
  delete_file:  '[del]',
  search_files: '[grep]',
};

export function PermissionDialog({ toolName, args, onDecide }: Props) {
  const { stdout } = useStdout();
  const W = (stdout?.columns ?? 80) - 2;

  useInput((_ch, key) => {
    if (_ch === '1') onDecide('once');
    if (_ch === '2') onDecide('session');
    if (_ch === '3' || key.escape) onDecide('cancel');
  });

  const tag   = TOOL_TAG[toolName] ?? '[tool]';
  const label = describeCall(toolName, args);

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
        <Box gap={1}>
          <Text color="#A78BFA" bold>[1]</Text>
          <Text color="#9CA3AF">Allow once</Text>
        </Box>
        <Box gap={1}>
          <Text color="#A78BFA" bold>[2]</Text>
          <Text color="#9CA3AF">{sessionLabel(toolName)}</Text>
        </Box>
        <Box gap={1}>
          <Text color="#EF4444" bold>[3]</Text>
          <Text color="#9CA3AF">Cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
