import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { GoalPlanState } from '../hooks/useGoal.js';

interface GoalPlanViewProps {
  planState: GoalPlanState;
  onRefinementSubmit: (instruction: string) => void;
}

export function GoalPlanView({ planState, onRefinementSubmit }: GoalPlanViewProps) {
  const [refinementText, setRefinementText] = useState('');
  const { phase, task, plan, steps } = planState;

  const handleRefinementSubmit = (val: string) => {
    if (!val.trim()) return;
    setRefinementText('');
    onRefinementSubmit(val.trim());
  };

  return (
    <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
      <Box gap={2}>
        <Text color="#F59E0B" bold>◆  Goal Plan</Text>
        {steps.length > 0 && (
          <Text color="#6B7280">({steps.length} steps)</Text>
        )}
        {(phase === 'planning' || phase === 'refining') && (
          <Text color="#6B7280" dimColor>
            {phase === 'planning' ? 'planning...' : 'refining...'}
          </Text>
        )}
        {phase === 'review' && (
          <Text color="#6B7280" dimColor>goal: {task}</Text>
        )}
      </Box>

      <Box paddingLeft={2} marginTop={1} flexDirection="column">
        <Text color="#9CA3AF" wrap="wrap">
          {plan}{phase === 'planning' ? '█' : ''}
        </Text>
      </Box>

      {phase === 'refining' && (
        <Box paddingLeft={2} marginTop={1} flexDirection="column" gap={0}>
          <Box gap={1}>
            <Text color="#8B5CF6" bold>◎</Text>
            <Text color="#6B7280">Refinement:</Text>
            <TextInput
              value={refinementText}
              onChange={setRefinementText}
              onSubmit={handleRefinementSubmit}
              placeholder="describe what to change..."
            />
          </Box>
          <Box paddingLeft={2}>
            <Text color="#4B5563">ESC to cancel</Text>
          </Box>
        </Box>
      )}

      {phase === 'review' && (
        <Box gap={4} paddingLeft={2} marginTop={1}>
          <Text color="#10B981" bold>▸ Enter execute</Text>
          <Text color="#8B5CF6">[E] refine</Text>
          <Text color="#6B7280">[R] regenerate</Text>
          <Text color="#6B7280">ESC cancel</Text>
        </Box>
      )}
    </Box>
  );
}
