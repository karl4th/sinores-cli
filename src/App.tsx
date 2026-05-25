import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { Box, useApp, useInput } from 'ink';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { Splash } from './components/Splash.js';
import { WelcomeBanner } from './components/WelcomeBanner.js';
import { MessageBubble, type Message } from './components/MessageBubble.js';
import { ThinkingIndicator } from './components/ThinkingIndicator.js';
import { PermissionDialog } from './components/PermissionDialog.js';
import { ToolCallBlock } from './components/ToolCallBlock.js';
import { InputArea } from './components/InputArea.js';
import { ResumeSelector } from './components/ResumeSelector.js';
import { StatusLine } from './components/StatusLine.js';
import { RoundLimitDialog } from './components/RoundLimitDialog.js';
import { GoalPlanView } from './components/GoalPlanView.js';
import { GoalExecutionView } from './components/GoalExecutionView.js';
import { useSession } from './hooks/useSession.js';
import { useAgent } from './hooks/useAgent.js';
import { useGoal } from './hooks/useGoal.js';
import { executeTool } from './services/tools.js';
import { countTokens } from './services/tokenizer.js';
import { CWD } from './services/tools.js';
import { compactMessages } from './services/ai.js';
import { buildSystemPrompt } from './services/prompt.js';

const ts = () => new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
const MemoWelcomeBanner = memo(WelcomeBanner);

interface AppProps {
  resume?: boolean;
}

export function App({ resume = false }: AppProps) {
  const { exit } = useApp();

  const [splashDone, setSplashDone] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tokens, setTokens] = useState(0);
  const [mode, setMode] = useState('chat');
  const [hasChat, setHasChat] = useState(false);
  const [exitPending, setExitPending] = useState(false);
  const [inputSeed, setInputSeed] = useState('');
  const [isCompacting, setIsCompacting] = useState(false);
  const clearPendingRef = React.useRef(false);

  // Keep latest messages/tokens in refs for use inside async callbacks
  const messagesRef = useRef(messages);
  const tokensRef = useRef(tokens);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);

  const addSystem = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: 'system', content, timestamp: ts() }]);
    setHasChat(true);
  }, []);

  const session = useSession(addSystem);
  const agent = useAgent(addSystem, session.saveCurrentSession);
  const goal = useGoal(addSystem);

  // ── init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (resume) {
      session.openResumeSelector();
    } else {
      session.startNewSession();
      setSplashDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── step runner for goal execution ──────────────────────────────────────────

  const runStep = useCallback(async (prompt: string): Promise<string> => {
    const result = await agent.runMessage(session.sessionMeta.current?.id ?? null, prompt, messagesRef.current, tokensRef.current);
    setMessages(result.messages);
    setTokens(result.tokens);
    const lastMsg = result.messages[result.messages.length - 1];
    return lastMsg?.content ?? '';
  }, [agent]);

  // ── commands ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (messages.length === 0) { addSystem('Nothing to export.'); return; }
    const date = new Date().toISOString().slice(0, 10);
    const filename = `sinores-${date}-${Date.now()}.md`;
    const outPath = path.join(CWD, filename);
    const lines = messages.map(m => {
      const who = m.role === 'user' ? '**you**' : m.role === 'assistant' ? '**sinores**' : '_system_';
      return `### ${who}  \`${m.timestamp ?? ''}\`\n\n${m.content}\n`;
    });
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `# sinores session — ${date}\n\n` + lines.join('\n---\n\n'), 'utf-8');
    addSystem(`Saved to ${filename}`);
  }, [messages, addSystem]);

  const runCommand = useCallback((raw: string) => {
    switch (raw) {
      case '/help':
        addSystem(
          'Commands:\n' +
          '  /help    — show this message\n' +
          '  /goal    — set a goal, plan it, then execute step by step\n' +
          '  /compact — compact conversation history to save context space\n' +
          '  /init    — scan project and create .sinores/SINORES.md\n' +
          '  /mode    — switch mode (e.g. /mode agent)\n' +
          '  /export  — save session to Markdown file\n' +
          '  /resume  — restore previous session from disk\n' +
          '  /new     — start a new session\n' +
          '  /clear   — reset conversation (requires confirmation)\n' +
          '\nGoal mode keys:\n' +
          '  Enter    — approve plan / continue step\n' +
          '  E        — refine plan with LLM\n' +
          '  R        — regenerate plan\n' +
          '  ESC      — cancel\n' +
          '\nKeyboard:\n' +
          '  ↑↓       — navigate input history\n' +
          '  Tab      — autocomplete command\n' +
          '  ESC      — stop running agent\n' +
          '  Ctrl+C   — exit (press twice)',
        );
        return true;
      case '/export':
        handleExport();
        return true;
      case '/resume':
        session.openResumeSelector();
        return true;
      case '/new':
        session.startNewSession();
        setMessages([]);
        agent.fullHistory.current = [];
        setTokens(0);
        setHasChat(false);
        addSystem('Started a new session.');
        return true;
      default:
        return false;
    }
  }, [addSystem, handleExport, session, agent]);

  // ── submit handler ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    setInputSeed('');

    if (raw.startsWith('/goal ')) {
      const task = raw.slice(6).trim();
      if (!task) { addSystem('Usage: /goal <description>'); return; }

      let context = '';
      try { context = await executeTool('read_file', { path: '.sinores/SINORES.md' }); } catch { /* no context */ }

      await goal.startGoal(task, context);
      return;
    }

    if (raw === '/compact') {
      const nonSystemCount = agent.fullHistory.current.length;
      if (nonSystemCount < 3) {
        addSystem('Not enough history to compact.');
        return;
      }
      setIsCompacting(true);
      try {
        const summary = await compactMessages(agent.fullHistory.current);
        agent.fullHistory.current = [{ role: 'user', content: summary }];
        const newMessages = [
          { role: 'system', content: 'Context compacted.', timestamp: ts() },
          { role: 'user', content: summary, timestamp: ts() },
        ] as Message[];
        setMessages(newMessages);
        const newTokens = countTokens(buildSystemPrompt()) + countTokens(summary);
        setTokens(newTokens);
        await session.saveCurrentSession(newMessages, agent.fullHistory.current, newTokens);
        addSystem('Context compacted successfully.');
      } catch (err) {
        addSystem(`Compaction failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsCompacting(false);
      }
      return;
    }

    if (raw === '/clear') {
      if (clearPendingRef.current) {
        setMessages([]);
        setTokens(0);
        setHasChat(false);
        agent.fullHistory.current = [];
        clearPendingRef.current = false;
        session.clearAndRestart();
      } else {
        clearPendingRef.current = true;
        addSystem('Type /clear again to confirm resetting the conversation.');
        setTimeout(() => { clearPendingRef.current = false; }, 3000);
      }
      return;
    }

    if (runCommand(raw)) return;

    if (raw.startsWith('/mode ')) {
      setMode(raw.split(' ')[1] ?? 'chat');
      return;
    }

    let value = raw;

    // Expand @filepath mentions into inline file content
    const atMatches = [...raw.matchAll(/@(\S+)/g)];
    if (atMatches.length > 0) {
      let expanded = raw;
      for (const m of atMatches) {
        const filepath = m[1]!;
        const content = await executeTool('read_file', { path: filepath });
        if (!content.startsWith('Error:')) {
          expanded = expanded.replace(
            m[0]!,
            `@${filepath}\n\`\`\`\n${content}\n\`\`\``,
          );
        }
      }
      value = expanded;
    }

    if (raw === '/init') {
      value = [
        'Initialize sinores for this project.',
        '1. Use list_dir to explore the project structure (root, and key subdirectories).',
        '2. Read important files: package.json, README.md, tsconfig.json, .env.example, and any main entry points.',
        '3. Create the file `.sinores/SINORES.md` with a concise project summary:',
        '   - What this project is and what it does',
        '   - Tech stack and key dependencies',
        '   - Project structure overview',
        '   - How to run/build/test',
        '   - Important conventions or notes',
        'Keep it tight — this file will be loaded as context in future sessions.',
      ].join('\n');
    }

    const userMsg: Message = { role: 'user', content: raw, timestamp: ts() };
    setMessages(prev => [...prev, userMsg]);
    setHasChat(true);
    setTokens(t => t + countTokens(value));

    const result = await agent.runMessage(session.sessionMeta.current?.id ?? null, value, [...messages, userMsg], tokens + countTokens(value));
    setMessages(result.messages);
    setTokens(result.tokens);
  }, [addSystem, runCommand, session, agent, goal, messages, tokens]);

  // ── keyboard ────────────────────────────────────────────────────────────────

  useInput((_ch, key) => {
    // ── Goal plan review (not refining — TextInput handles that) ──
    if (goal.planState && goal.planState.phase !== 'refining' && !agent.isLoading) {
      if (key.return) {
        goal.approvePlan(runStep);
        return;
      }
      if (_ch === 'e' || _ch === 'E') {
        goal.enterRefine();
        return;
      }
      if (_ch === 'r' || _ch === 'R') {
        goal.regenerateGoal();
        return;
      }
      if (key.escape) {
        goal.cancelGoal();
        addSystem('Goal cancelled.');
        return;
      }
      return;
    }

    // ── Goal plan refining: ESC cancels, TextInput handles the rest ──
    if (goal.planState?.phase === 'refining') {
      if (key.escape) {
        goal.cancelRefine();
        return;
      }
      return;
    }

    // ── Goal execution paused (waiting for step confirm) ──
    if (goal.execState?.paused && !agent.isLoading) {
      if (key.return) {
        goal.continueStep();
        return;
      }
      if (key.escape) {
        goal.stopExecution();
        return;
      }
      return;
    }

    // ── Goal execution running: ESC stops ──
    if (goal.execState && !goal.execState.paused) {
      if (key.escape || (key.ctrl && _ch === 'c')) {
        goal.stopExecution();
        agent.stopAgent();
        return;
      }
      return;
    }

    // ── Round limit dialog ──
    if (agent.roundLimitPending) {
      if (key.leftArrow || key.rightArrow) {
        agent.setContinueYes(y => !y);
        return;
      }
      if (key.return) {
        agent.resolveRoundLimit(agent.continueYes);
        return;
      }
      if (key.escape) {
        agent.resolveRoundLimit(false);
        return;
      }
      return;
    }

    // ── Permission dialog: block all except Ctrl+C ──
    if (agent.pendingPermission) {
      if (key.tab) return;
      if (key.ctrl && _ch === 'c') {
        agent.stopAgent();
        return;
      }
      return;
    }

    // ── Agent running: ESC stops ──
    if (agent.isLoading && (key.escape || (key.ctrl && _ch === 'c'))) {
      agent.stopAgent();
      return;
    }

    // ── Exit on double Ctrl+C ──
    if (!key.ctrl || _ch !== 'c') return;
    if (exitPending) { exit(); }
    else {
      setExitPending(true);
      setTimeout(() => setExitPending(false), 2000);
    }
  });

  // ── resume load ─────────────────────────────────────────────────────────────

  const handleActivateSession = useCallback(async (id: string) => {
    const data = await session.activateSession(id);
    if (data) {
      setMessages(data.messages);
      agent.fullHistory.current = data.fullHistory;
      setTokens(data.tokens);
      setHasChat(data.messages.length > 0);
    }
  }, [session, agent]);

  // ── render ──────────────────────────────────────────────────────────────────

  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />;

  if (session.showResume) {
    return (
      <ResumeSelector
        sessions={session.sessionsList}
        onSelect={handleActivateSession}
        onCancel={() => { session.setShowResume(false); if (!hasChat) { session.startNewSession(); } }}
      />
    );
  }

  const ctxPct = Math.min(100, Math.round((tokens / 200_000) * 100));

  return (
    <Box flexDirection="column">
      <MemoWelcomeBanner />

      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {isCompacting && (
        <Box flexDirection="column">
          <ThinkingIndicator
            liveContent=""
            liveThinkingText="Compacting context…"
            liveThinkingChars={0}
          />
        </Box>
      )}

      {agent.isLoading && (
        <Box flexDirection="column">
          <ThinkingIndicator
            liveContent={agent.live.content}
            liveThinkingText={agent.live.thinking}
            liveThinkingChars={agent.live.thinkingChars}
          />
          {agent.liveToolCalls.map(tc => (
            <ToolCallBlock key={tc.id} tc={tc} />
          ))}
        </Box>
      )}

      {agent.pendingPermission ? (
        <PermissionDialog
          toolName={agent.pendingPermission.toolName}
          args={agent.pendingPermission.args}
          onDecide={agent.pendingPermission.resolve}
        />
      ) : agent.roundLimitPending ? (
        <Box flexDirection="column">
          <RoundLimitDialog continueYes={agent.continueYes} />
          <StatusLine model="kimi-k2.6" mode={mode} tokens={tokens} contextPct={ctxPct} />
        </Box>
      ) : goal.execState ? (
        <Box flexDirection="column">
          <GoalExecutionView execState={goal.execState} />
          <StatusLine model="kimi-k2.6" mode={mode} tokens={tokens} contextPct={ctxPct} />
        </Box>
      ) : goal.planState ? (
        <Box flexDirection="column">
          <GoalPlanView
            planState={goal.planState}
            onRefinementSubmit={goal.refineGoal}
          />
          <StatusLine model="kimi-k2.6" mode={mode} tokens={tokens} contextPct={ctxPct} />
        </Box>
      ) : (
        <>
          <InputArea
            onSubmit={handleSubmit}
            isLoading={agent.isLoading || isCompacting}
            exitPending={exitPending}
            initialValue={inputSeed}
          />
          <StatusLine model="kimi-k2.6" mode={mode} tokens={tokens} contextPct={ctxPct} />
        </>
      )}
    </Box>
  );
}
