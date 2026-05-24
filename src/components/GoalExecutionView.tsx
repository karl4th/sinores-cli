import React from 'react';
import { Box, Text } from 'ink';
import type { GoalExecState, StepStatus } from '../hooks/useGoal.js';

const ICON: Record<StepStatus, string> = {
  pending: '○',
  running: '▶',
  done:    '✓',
};

const COLOR: Record<StepStatus, string> = {
  pending: '#4B5563',
  running: '#F59E0B',
  done:    '#10B981',
};

interface GoalExecutionViewProps {
  execState: GoalExecState;
}

export function GoalExecutionView({ execState }: GoalExecutionViewProps) {
  const { task, steps, stepStatus, currentStep, paused } = execState;

  return (
    <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
      <Text color="#F59E0B" bold>◆  Executing: {task}</Text>

      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        {steps.map((step, i) => {
          const status = stepStatus[i] ?? 'pending';
          const isCurrent = i === currentStep;
          return (
            <Box key={i} gap={1}>
              <Text color={COLOR[status]} bold={isCurrent}>
                {ICON[status]}
              </Text>
              <Text color={isCurrent ? '#E5E7EB' : status === 'done' ? '#6B7280' : '#4B5563'} bold={isCurrent}>
                {i + 1}. {step}
              </Text>
            </Box>
          );
        })}
      </Box>

      {paused && (
        <Box flexDirection="column" paddingLeft={2} marginTop={1}>
          <Text color="#374151">────────────────────────</Text>
          <Box gap={4}>
            <Text color="#10B981" bold>▸ Enter continue</Text>
            <Text color="#6B7280">ESC stop</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
