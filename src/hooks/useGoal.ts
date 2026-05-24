import { useState, useRef, useCallback } from 'react';
import { generatePlan, type PlanRefinement } from '../services/ai.js';

export type GoalPhase = 'planning' | 'review' | 'refining';

export interface GoalPlanState {
  phase: GoalPhase;
  task: string;
  context: string;
  plan: string;
  steps: string[];
}

export type StepStatus = 'pending' | 'running' | 'done';

export interface GoalExecState {
  task: string;
  steps: string[];
  stepStatus: StepStatus[];
  currentStep: number;
  paused: boolean;
}

function parseSteps(plan: string): string[] {
  const match = plan.match(/##\s*Steps?\s*\n([\s\S]*?)(?:\n##|$)/i);
  const block = match?.[1] ?? '';
  const lines = block
    .split('\n')
    .map(l => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
  if (lines.length > 0) return lines;
  // fallback: any numbered list in the whole plan
  const numbered = plan.match(/^\d+\.\s+.+/gm);
  return numbered?.map(l => l.replace(/^\d+\.\s+/, '').trim()) ?? [];
}

function buildStepPrompt(
  task: string,
  plan: string,
  steps: string[],
  stepIndex: number,
  prevResults: string[],
): string {
  const lines: string[] = [
    `Goal: ${task}`,
    '',
    'Full execution plan:',
    plan,
  ];

  if (prevResults.length > 0) {
    lines.push('', 'Completed steps so far:');
    prevResults.forEach((r, i) => {
      lines.push(`Step ${i + 1} result: ${r}`);
    });
  }

  lines.push(
    '',
    `Now execute Step ${stepIndex + 1} of ${steps.length}: ${steps[stepIndex]!}`,
    '',
    'Focus only on this step. When done, briefly summarize what you accomplished (1-2 sentences).',
  );

  return lines.join('\n');
}

export function useGoal(addSystem: (msg: string) => void) {
  const [planState, setPlanState] = useState<GoalPlanState | null>(null);
  const [execState, setExecState] = useState<GoalExecState | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const planBuf = useRef('');
  const confirmResolve = useRef<((go: boolean) => void) | null>(null);

  const startGoal = useCallback(async (
    task: string,
    context: string,
    refinement?: PlanRefinement,
  ) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    planBuf.current = '';

    setPlanState({ phase: 'planning', task, context, plan: '', steps: [] });

    try {
      await generatePlan(task, context, refinement ?? null, {
        onThinkingChunk: () => {},
        onContentChunk: (text) => {
          planBuf.current += text;
          setPlanState({ phase: 'planning', task, context, plan: planBuf.current, steps: [] });
        },
      }, ac.signal);

      if (!ac.signal.aborted) {
        const finalPlan = planBuf.current;
        planBuf.current = '';
        setPlanState({ phase: 'review', task, context, plan: finalPlan, steps: parseSteps(finalPlan) });
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        planBuf.current = '';
        setPlanState(null);
        addSystem(`Error planning: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [addSystem]);

  const refineGoal = useCallback(async (instruction: string) => {
    if (!planState) return;
    await startGoal(planState.task, planState.context, {
      instruction,
      previousPlan: planState.plan,
    });
  }, [planState, startGoal]);

  const regenerateGoal = useCallback(async () => {
    if (!planState) return;
    await startGoal(planState.task, planState.context);
  }, [planState, startGoal]);

  const enterRefine = useCallback(() => {
    setPlanState(prev => prev ? { ...prev, phase: 'refining' } : null);
  }, []);

  const cancelRefine = useCallback(() => {
    setPlanState(prev => prev ? { ...prev, phase: 'review' } : null);
  }, []);

  const cancelGoal = useCallback(() => {
    abortRef.current?.abort();
    planBuf.current = '';
    confirmResolve.current?.(false);
    confirmResolve.current = null;
    setPlanState(null);
    setExecState(null);
  }, []);

  const approvePlan = useCallback(async (runStep: (prompt: string) => Promise<string>) => {
    if (!planState || planState.phase !== 'review') return;
    const { task, plan, steps } = planState;
    setPlanState(null);

    if (steps.length === 0) {
      addSystem('No steps found in plan — try regenerating with [R].');
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const stepStatus: StepStatus[] = steps.map(() => 'pending');
    const results: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      if (ac.signal.aborted) break;

      stepStatus[i] = 'running';
      setExecState({ task, steps, stepStatus: [...stepStatus], currentStep: i, paused: false });

      const prompt = buildStepPrompt(task, plan, steps, i, results);
      try {
        const result = await runStep(prompt);
        results.push(result);
      } catch {
        results.push('(step failed)');
      }

      stepStatus[i] = 'done';

      if (i < steps.length - 1 && !ac.signal.aborted) {
        setExecState({ task, steps, stepStatus: [...stepStatus], currentStep: i, paused: true });

        const cont = await new Promise<boolean>(resolve => {
          confirmResolve.current = resolve;
        });

        if (!cont) break;
      }
    }

    if (!ac.signal.aborted) {
      setExecState(null);
      addSystem('Goal execution complete.');
    }
  }, [planState, addSystem]);

  const continueStep = useCallback(() => {
    confirmResolve.current?.(true);
    confirmResolve.current = null;
  }, []);

  const stopExecution = useCallback(() => {
    abortRef.current?.abort();
    confirmResolve.current?.(false);
    confirmResolve.current = null;
    setExecState(null);
    addSystem('Goal execution stopped.');
  }, [addSystem]);

  return {
    planState,
    execState,
    startGoal,
    refineGoal,
    regenerateGoal,
    enterRefine,
    cancelRefine,
    cancelGoal,
    approvePlan,
    continueStep,
    stopExecution,
  };
}
