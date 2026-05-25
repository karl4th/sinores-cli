import OpenAI from 'openai';
import { TOOL_DEFINITIONS, executeTool, permissionKey, type ToolName } from './tools.js';
import { buildSystemPrompt, COMPACT_SUMMARY_PROMPT } from './prompt.js';
import { loadMemory } from './memory.js';
import { logDecision } from './project-state.js';
import { getMoonshotApiKey } from './config.js';

const client = new OpenAI({
  apiKey:   getMoonshotApiKey() ?? 'missing',
  baseURL:  'https://api.moonshot.ai/v1',
});

const MAX_ROUNDS = 50;

const PLANNER_PROMPT = `You are a meticulous planning assistant embedded in a coding agent called sinores.

Your job is to analyze a user's goal and produce a detailed, step-by-step execution plan.

Rules:
1. Carefully analyze WHAT the user wants and WHY.
2. If project context is provided, use it to understand the codebase structure.
3. Think about edge cases, dependencies, and potential pitfalls.
4. Each step must be concrete, actionable, and executable by a coding agent.
5. If a refinement instruction is provided, improve the previous plan accordingly.
6. Choose the CORRECT approach, not the quickest or easiest.
7. Do NOT write code — only produce the plan.

IMPORTANT: Format your response EXACTLY as follows (use these exact section headers):

## Analysis
[Brief analysis of what needs to be done and key considerations]

## Steps
1. [First concrete action]
2. [Second concrete action]
3. [Continue as needed...]

## Expected Outcome
[What will be achieved when all steps are complete]

The ## Steps section must contain numbered steps, one per line. These steps will be executed one at a time by the agent.`;

export type Permission = 'once' | 'session' | 'cancel';

export interface ToolCallState {
  id:      string;
  name:    ToolName;
  args:    Record<string, string>;
  status:  'waiting' | 'running' | 'done' | 'cancelled' | 'error';
  result?: string;
}

export interface AgentCallbacks {
  onThinkingChunk:   (text: string) => void;
  onContentChunk:    (text: string) => void;
  onToolCallStart:   (tc: ToolCallState) => void;
  onToolCallDone:    (id: string, result: string, status: 'done' | 'cancelled' | 'error') => void;
  onDone:            (thinkingChars: number, updatedHistory: ChatMsg[]) => void;
  onError:           (err: Error) => void;
  onRoundLimit?:     (history: ChatMsg[]) => Promise<boolean>;
  requestPermission: (name: ToolName, args: Record<string, string>) => Promise<Permission>;
}

export type ChatMsg =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'tool'; tool_call_id: string; content: string };

// ── one streaming round ───────────────────────────────────────────────────────

interface RoundResult {
  thinkingText: string;
  content:      string;
  toolCalls:    Array<{ id: string; name: string; arguments: string }>;
  finishReason: string | null;
}

async function oneRound(
  messages: ChatMsg[],
  signal:   AbortSignal,
  callbacks: Pick<AgentCallbacks, 'onThinkingChunk' | 'onContentChunk'>,
): Promise<RoundResult> {
  const accumulated: Record<number, { id: string; name: string; arguments: string }> = {};
  let thinkingText = '';
  let content      = '';
  let finishReason: string | null = null;

  // Cast to any: Kimi K2.6 adds `thinking` param not in OpenAI SDK types,
  // and TOOL_DEFINITIONS is readonly while the SDK expects a mutable array.
  const kimiParams: any = {
    model:       'kimi-k2.6',
    messages,
    tools:       TOOL_DEFINITIONS,
    tool_choice: 'auto',
    temperature: 1,
    max_tokens:  32768,
    top_p:       0.95,
    thinking:    { type: 'enabled', budget_tokens: 8000 },
    stream:      true,
  };
  const stream = await client.chat.completions.create(kimiParams) as unknown as AsyncIterable<any>;

  for await (const chunk of stream) {
    if (signal.aborted) break;

    const choice = chunk.choices[0];
    if (!choice) continue;

    if (choice.finish_reason) finishReason = choice.finish_reason;

    const delta = choice.delta as {
      content?:           string;
      reasoning_content?: string;
      thinking_content?:  string;
      tool_calls?:        Array<{
        index:     number;
        id?:       string;
        function?: { name?: string; arguments?: string };
      }>;
    };

    const thinkingChunk = delta.reasoning_content ?? delta.thinking_content;
    if (thinkingChunk) {
      thinkingText += thinkingChunk;
      callbacks.onThinkingChunk(thinkingChunk);
    }
    if (delta.content) {
      content += delta.content;
      callbacks.onContentChunk(delta.content);
    }
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (!accumulated[tc.index]) {
          accumulated[tc.index] = { id: tc.id ?? '', name: '', arguments: '' };
        }
        const a = accumulated[tc.index]!;
        if (tc.function?.name)      a.name      += tc.function.name;
        if (tc.function?.arguments) a.arguments += tc.function.arguments;
        if (tc.id)                  a.id         = tc.id;
      }
    }
  }

  return { thinkingText, content, toolCalls: Object.values(accumulated), finishReason };
}

// ── main agentic loop ─────────────────────────────────────────────────────────

export type { ChatMsg as ChatMessage };

// #13 fix: trim oldest complete exchanges when history grows too large
function truncateHistory(history: ChatMsg[], maxMessages = 60): ChatMsg[] {
  if (history.length <= maxMessages) return history;

  // Find a safe cut point at a 'user' message boundary so we never
  // orphan a tool_call/tool_result pair in the middle of an exchange
  for (let i = 1; i < history.length - maxMessages; i++) {
    if (history[i]!.role === 'user') {
      return history.slice(i);
    }
  }
  // No user boundary found — hard-slice to keep the most recent messages
  return history.slice(history.length - maxMessages);
}

export interface PlanRefinement {
  instruction: string;
  previousPlan: string;
}

export async function generatePlan(
  task:      string,
  context:   string,
  refinement: PlanRefinement | null,
  callbacks: Pick<AgentCallbacks, 'onThinkingChunk' | 'onContentChunk'>,
  signal:    AbortSignal,
): Promise<void> {
  if (!getMoonshotApiKey()) {
    throw new Error('MOONSHOT_API_KEY not set — run: sinores --init-config or set MOONSHOT_API_KEY env var');
  }

  const parts: string[] = [];
  if (context) parts.push(`Project context:\n${context}`);
  parts.push(`Goal: ${task}`);
  if (refinement) {
    parts.push(`Previous plan:\n${refinement.previousPlan}`);
    parts.push(`Refinement instruction: "${refinement.instruction}"\n\nPlease produce an improved plan that incorporates this refinement.`);
  }
  const userMsg = parts.join('\n\n');

  const messages = [
    { role: 'system' as const, content: PLANNER_PROMPT },
    { role: 'user' as const, content: userMsg },
  ];

  const kimiParams: any = {
    model:       'kimi-k2.6',
    messages,
    temperature: 1,
    max_tokens:  16384,
    top_p:       0.95,
    thinking:    { type: 'enabled', budget_tokens: 4000 },
    stream:      true,
  };

  const stream = await client.chat.completions.create(kimiParams) as unknown as AsyncIterable<any>;

  for await (const chunk of stream) {
    if (signal.aborted) return;

    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta as {
      content?:           string;
      reasoning_content?: string;
      thinking_content?:  string;
    };

    const thinkingChunk = delta.reasoning_content ?? delta.thinking_content;
    if (thinkingChunk) callbacks.onThinkingChunk(thinkingChunk);
    if (delta.content) callbacks.onContentChunk(delta.content);
  }
}

export async function compactMessages(history: ChatMsg[]): Promise<string> {
  if (!getMoonshotApiKey()) {
    throw new Error('MOONSHOT_API_KEY not set — run: sinores --init-config or set MOONSHOT_API_KEY env var');
  }

  const lines: string[] = [];
  for (const msg of history) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      lines.push(`Result (${msg.tool_call_id}):\n${msg.content}`);
      continue;
    }

    if (msg.role === 'assistant') {
      const anyMsg = msg as any;
      if (anyMsg.tool_calls?.length) {
        for (const tc of anyMsg.tool_calls) {
          lines.push(`Tool: ${tc.function.name}(${tc.function.arguments})`);
        }
      }
      if (anyMsg.reasoning_content) {
        lines.push(`Thinking: ${anyMsg.reasoning_content}`);
      }
      if (msg.content) {
        lines.push(`Assistant: ${msg.content}`);
      }
      continue;
    }

    lines.push(`User: ${msg.content}`);
  }

  const transcript = lines.join('\n\n');

  const response = await client.chat.completions.create({
    model: 'kimi-k2.6',
    messages: [
      { role: 'system', content: COMPACT_SUMMARY_PROMPT },
      { role: 'user', content: transcript },
    ],
    temperature: 1,
    max_tokens: 16384,
    top_p: 0.95,
    stream: false,
  } as any) as any;

  const content = response.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('Compact summary returned empty content');
  }
  return content;
}

export async function runAgent(
  history:        ChatMsg[],
  sessionAllowed: Set<string>,
  callbacks:      AgentCallbacks,
  signal:         AbortSignal,       // #5 fix: caller controls cancellation
  sessionId?:     string,
): Promise<void> {
  // #29 fix: clear env check before first API call
  if (!getMoonshotApiKey()) {
    callbacks.onError(new Error('MOONSHOT_API_KEY not set — run: sinores --init-config or set MOONSHOT_API_KEY env var'));
    return;
  }

  const memory = loadMemory();
  const messages: ChatMsg[] = [
    { role: 'system', content: buildSystemPrompt(memory) },
    ...truncateHistory(history),
  ];

  let totalThinkingChars = 0;
  let rounds = 0;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    callbacks.onDone(totalThinkingChars, messages.slice(1));
  };

  try {
    while (true) {
      if (signal.aborted) { finish(); return; }

      if (++rounds > MAX_ROUNDS) {
        if (callbacks.onRoundLimit) {
          const shouldContinue = await callbacks.onRoundLimit(messages.slice(1));
          if (shouldContinue) { rounds = 0; continue; }
        }
        finish();
        return;
      }

      const round = await oneRound(messages, signal, {
        onThinkingChunk: (t) => {
          totalThinkingChars += t.length;
          callbacks.onThinkingChunk(t);
        },
        onContentChunk: callbacks.onContentChunk,
      });

      if (signal.aborted) { finish(); return; }

      // Push assistant turn
      const assistantMsg: Record<string, unknown> = {
        role:    'assistant',
        content: round.content || '',
      };
      if (round.thinkingText) {
        assistantMsg['reasoning_content'] = round.thinkingText;
      }
      if (round.toolCalls.length > 0) {
        assistantMsg['tool_calls'] = round.toolCalls.map(tc => ({
          id:       tc.id,
          type:     'function',
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }
      messages.push(assistantMsg as ChatMsg);

      // Done — no more tool calls
      if (round.finishReason !== 'tool_calls' || round.toolCalls.length === 0) {
        finish();
        return;
      }

      // Execute tool calls
      let userCancelled = false;
      for (const tc of round.toolCalls) {
        if (signal.aborted || userCancelled) break;

        const name = tc.name as ToolName;
        let   args: Record<string, string> = {};
        try { args = JSON.parse(tc.arguments); } catch { /* ignore */ }

        const pKey = permissionKey(name, args);
        let   permission: Permission = 'once';

        const sessionKey = name === 'run_command' ? pKey : name;

        if (!sessionAllowed.has(sessionKey) && !sessionAllowed.has(pKey)) {
          permission = await callbacks.requestPermission(name, args);
          if (permission === 'session') sessionAllowed.add(sessionKey);
        }

        const tcState: ToolCallState = {
          id: tc.id, name, args,
          status: permission === 'cancel' ? 'cancelled' : 'running',
        };
        callbacks.onToolCallStart(tcState);

        let result: string;
        let finalStatus: 'done' | 'cancelled' | 'error' = 'done';

        if (permission === 'cancel') {
          result        = 'User cancelled this operation.';
          finalStatus   = 'cancelled';
          userCancelled = true;
        } else {
          try {
            result = await executeTool(name, args, signal);
            if (result.startsWith('Error:')) finalStatus = 'error';
          } catch (err) {
            result      = `Error: ${err instanceof Error ? err.message : String(err)}`;
            finalStatus = 'error';
          }
        }

        callbacks.onToolCallDone(tc.id, result, finalStatus);
        if (sessionId) logDecision(sessionId, name, args, result);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      // Stop the loop if user cancelled a tool — don't let the agent retry
      if (userCancelled || signal.aborted) { finish(); return; }
    }
  } catch (err) {
    if (signal.aborted) {
      finish();
    } else {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
