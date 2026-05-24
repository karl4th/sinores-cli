import React from 'react';
import { Box, Text } from 'ink';

export interface RoundLimitDialogProps {
  continueYes: boolean;
}

export function RoundLimitDialog({ continueYes }: RoundLimitDialogProps) {
  return (
    <Box flexDirection="column" paddingLeft={3} marginBottom={1}>
      <Text color="#F59E0B" bold>◆  Agent reached round limit. Continue?</Text>
      <Box gap={3} paddingLeft={2}>
        <Text color={continueYes ? '#10B981' : '#6B7280'} bold={continueYes}>{continueYes ? '▸ Yes' : '  Yes'}</Text>
        <Text color={!continueYes ? '#EF4444' : '#6B7280'} bold={!continueYes}>{!continueYes ? '▸ No' : '  No'}</Text>
      </Box>
    </Box>
  );
}
