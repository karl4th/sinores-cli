import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  generateSessionId,
  listSessions,
  loadSession as loadSessionData,
  saveSession as saveSessionData,
  clearCurrentSession as clearCurrentSessionFile,
  deleteSession,
  type SessionMeta,
} from './services/session.js';
import { Splash } from './components/Splash.js';
import { WelcomeBanner } from './components/WelcomeBanner.js';
import { MessageBubble, type Message } from './components/MessageBubble.js';
import { ThinkingIndicator } from './components/ThinkingIndicator.js';
import { PermissionDialog } from './components/PermissionDialog.js';
import { ToolCallBlock } from './components/ToolCallBlock.js';
import { InputArea } from './components/InputArea.js';
import { ResumeSelector } from './components/ResumeSelector.js';
import { runAgent, type ToolCallState, type Permission, type ChatMsg } from './services/ai.js';
import { CWD, executeTool } from './services/tools.js';
import type { ToolName } from './services/tools.js';
import { countTokens } from './services/tokenizer.js';

interface PendingPermission {
  toolName: ToolName;
  args: Record<string, string>;
  resolve: (p: Permission) => void;
}

interface AppProps {
  resume?: boolean;
}

interface LiveState {
  content: string;
  thinking: string;
  thinkingChars: number;
}

const ts = () => new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

const MemoWelcomeBanner = memo(WelcomeBanner);

const MODE_COLOR: Record<string, string> = {
  chat: '#06B6D4',
  agent: '#A78BFA',
  code: '#10B981',
  research: '#F59E0B',
};

function StatusLine({ model, mode, tokens, contextPct }: { model: string; mode: string; tokens: number; contextPct: number }) {
  const modeColor = MODE_COLOR[mode] ?? '#9CA3AF';
  const ctxColor = contextPct > 80 ? '#EF4444' : contextPct > 60 ? '#F59E0B' : '#10B981';
  const tokLabel = tokens > 0 ? tokens.toLocaleString() + ' tok' : '0 tok';

  return (
    <Box paddingLeft={3} paddingTop={0}>
      <Text color="#8B5CF6" bold>◆</Text>
      <Text color="#4B5563">  {model}  ·  </Text>
      <Text color={modeColor}>{mode}</Text>
      <Text color="#4B5563">  ·  {tokLabel}  ·  ctx </Text>
      <Text color={ctxColor}>{contextPct}%</Text>
    </Box>
  );
}

export function App({ resume = false }: AppProps) {
  const { exit } = useApp();

  const [splashDone, setSplashDone] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [exitPending, setExitPending] = useState(false);
  const [mode, setMode] = useState('chat');
  const [hasChat, setHasChat] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [sessionsList, setSessionsList] = useState<SessionMeta[]>([]);

  const [live, setLive] = useState<LiveState>({ content: '', thinking: '', thinkingChars: 0 });
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCallState[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const pendingPermissionRef = useRef(pendingPermission);
  pendingPermissionRef.current = pendingPermission;
  const [roundLimitPending, setRoundLimitPending] = useState(false);
  const [continueYes, setContinueYes] = useState(true);
  const roundLimitResolve = useRef<(cont: boolean) => void>();

  const fullHistory = useRef<ChatMsg[]>([]);
  const sessionAllowed = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const sessionMeta = useRef<{ id: string; name: string; createdAt: string } | null>(null);

  const contentBuf = useRef('');
  const thinkingBuf = useRef('');
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  const flushStreaming = useCallback(() => {
    setLive({
      content: contentBuf.current,
      thinking: thinkingBuf.current,
      thinkingChars: thinkingBuf.current.length,
    });
    flushTimer.current = null;
  }, []);

  const scheduleFlush = useCallback(() => {
    if (!flushTimer.current) {
      flushTimer.current = setTimeout(flushStreaming, 300);
    }
  }, [flushStreaming]);

  useEffect(() => {
    if (resume) {
      openResumeSelector();
    } else {
      startNewSession();
      setSplashDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startNewSession(name?: string) {
    const id = generateSessionId();
    const now = new Date().toISOString();
    sessionMeta.current = { id, name: name || '', createdAt: now };
    setMessages([]);
    fullHistory.current = [];
    setTokens(0);
    setHasChat(false);
    setLive({ content: '', thinking: '', thinkingChars: 0 });
    setLiveToolCalls([]);
  }

  async function openResumeSelector() {
    const list = await listSessions();
    if (list.length === 0) {
      addSystem('No saved sessions found. Starting fresh.');
      await startNewSession();
    } else {
      setSessionsList(list);
      setShowResume(true);
    }
    setSplashDone(true);
  }

  async function saveCurrentSession(msgs: Message[], hist: ChatMsg[], tok: number) {
    if (!sessionMeta.current) return;
    let name = sessionMeta.current.name;
    if (!name) {
      const firstUser = msgs.find(m => m.role === 'user');
      name = firstUser
        ? firstUser.content.slice(0, 40).replace(/\n/g, ' ')
        : `Session ${new Date().toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}`;
      sessionMeta.current.name = name;
    }
    await saveSessionData({
      id: sessionMeta.current.id,
      name,
      messages: msgs,
      fullHistory: hist,
      tokens: tok,
      createdAt: sessionMeta.current.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  async function activateSession(id: string) {
    const data = await loadSessionData(id);
    if (!data) {
      addSystem('Failed to load session.');
      setShowResume(false);
      return;
    }
    sessionMeta.current = { id: data.id, name: data.name, createdAt: data.createdAt };
    setMessages(data.messages);
    fullHistory.current = data.fullHistory;
    setTokens(data.tokens);
    setHasChat(data.messages.length > 0);
    setShowResume(false);
  }

  const addSystem = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: 'system', content, timestamp: ts() }]);
    setHasChat(true);
  }, []);

  const stopAgent = useCallback(() => {
    abortRef.current?.abort();
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    contentBuf.current = '';
    thinkingBuf.current = '';
    setIsLoading(false);
    setLive({ content: '', thinking: '', thinkingChars: 0 });
    setLiveToolCalls([]);
    // Cancel any pending permission / round-limit so the agent loop can exit
    pendingPermissionRef.current?.resolve('cancel');
    setPendingPermission(null);
    if (roundLimitResolve.current) {
      setRoundLimitPending(false);
      roundLimitResolve.current(false);
      roundLimitResolve.current = undefined;
    }
    addSystem('Agent stopped.');
  }, [addSystem]);

  useInput((_ch, key) => {
    if (roundLimitPending) {
      if (key.leftArrow || key.rightArrow) {
        setContinueYes(y => !y);
        return;
      }
      if (key.return) {
        setRoundLimitPending(false);
        roundLimitResolve.current?.(continueYes);
        return;
      }
      if (key.escape) {
        setRoundLimitPending(false);
        roundLimitResolve.current?.(false);
        return;
      }
      return;
    }

    if (pendingPermission) {
      // Let PermissionDialog handle its own keys; block Tab and Ctrl+C only
      if (key.tab) return;
      if (key.ctrl && _ch === 'c') {
        stopAgent();
        return;
      }
      return;
    }

    if (isLoading && (key.escape || (key.ctrl && _ch === 'c'))) {
      stopAgent();
      return;
    }
    if (!key.ctrl || _ch !== 'c') return;
    if (exitPending) { exit(); }
    else {
      setExitPending(true);
      setTimeout(() => setExitPending(false), 2000);
    }
  });

  const requestPermission = useCallback(
    (name: ToolName, args: Record<string, string>): Promise<Permission> =>
      new Promise(resolve => {
        setPendingPermission({
          toolName: name,
          args,
          resolve: (p) => { setPendingPermission(null); resolve(p); },
        });
      }),
    [],
  );

  const handleExport = useCallback(async () => {
    const msgs = messagesRef.current;
    if (msgs.length === 0) { addSystem('Nothing to export.'); return; }
    const date = new Date().toISOString().slice(0, 10);
    const filename = `sinores-${date}-${Date.now()}.md`;
    const outPath = path.join(CWD, filename);
    const lines = msgs.map(m => {
      const who = m.role === 'user' ? '**you**' : m.role === 'assistant' ? '**sinores**' : '_system_';
      return `### ${who}  \`${m.timestamp ?? ''}\`\n\n${m.content}\n`;
    });
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `# sinores session — ${date}\n\n` + lines.join('\n---\n\n'), 'utf-8');
    addSystem(`Saved to ${filename}`);
  }, [addSystem]);

  const runCommand = useCallback((raw: string) => {
    switch (raw) {
      case '/help':
        addSystem(
          'Commands:\n' +
          '  /help    — show this message\n' +
          '  /init    — scan project and create .sinores/SINORES.md\n' +
          '  /model   — switch AI model (e.g. /model gpt-4o)\n' +
          '  /mode    — switch mode (e.g. /mode agent)\n' +
          '  /export  — save session to Markdown file\n' +
          '  /resume  — restore previous session from disk\n' +
          '  /new     — start a new session\n' +
          '  /clear   — reset conversation (requires confirmation)\n' +
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
        openResumeSelector();
        return true;
      case '/new':
        startNewSession();
        addSystem('Started a new session.');
        return true;
      default:
        return false;
    }
  }, [addSystem, handleExport]);

  const clearPendingRef = useRef(false);

  const handleSubmit = useCallback(async (raw: string) => {
    if (!raw.trim()) return;

    if (raw === '/clear') {
      if (clearPendingRef.current) {
        setMessages([]); setTokens(0); setHasChat(false);
        fullHistory.current = [];
        clearPendingRef.current = false;
        const oldId = sessionMeta.current?.id;
        clearCurrentSessionFile();
        if (oldId) deleteSession(oldId);
        startNewSession();
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
    setIsLoading(true);
    setLive({ content: '', thinking: '', thinkingChars: 0 });
    setLiveToolCalls([]);
    setTokens(t => t + countTokens(value));

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    fullHistory.current = [...fullHistory.current, { role: 'user' as const, content: value }];

    runAgent(fullHistory.current, sessionAllowed.current, {
      onThinkingChunk: (text) => {
        thinkingBuf.current += text;
        scheduleFlush();
      },
      onContentChunk: (text) => {
        contentBuf.current += text;
        scheduleFlush();
      },
      onToolCallStart: (tc) => {
        setLiveToolCalls(prev => [...prev, tc]);
      },
      onToolCallDone: (id, result, status) => {
        setLiveToolCalls(prev => prev.map(t => t.id === id ? { ...t, status, result } : t));
      },
      onDone: (thinkingChars, updatedHistory) => {
        if (flushTimer.current) {
          clearTimeout(flushTimer.current);
          flushTimer.current = null;
        }
        const finalContent = contentBuf.current;
        const finalThinking = thinkingBuf.current;
        contentBuf.current = '';
        thinkingBuf.current = '';
        fullHistory.current = updatedHistory;

        const newMsg: Message = {
          role: 'assistant',
          content: finalContent || '(no response)',
          thinkingTokens: thinkingChars,
          timestamp: ts(),
        };

        const nextMessages = [...messagesRef.current, newMsg];
        const newTokens = tokensRef.current + countTokens(finalContent) + countTokens(finalThinking);

        setMessages(nextMessages);
        setTokens(newTokens);
        setIsLoading(false);
        setLive({ content: '', thinking: '', thinkingChars: 0 });
        setLiveToolCalls([]);
        saveCurrentSession(nextMessages, updatedHistory, newTokens);
      },
      onError: (err) => {
        if (flushTimer.current) {
          clearTimeout(flushTimer.current);
          flushTimer.current = null;
        }
        const finalContent = contentBuf.current;
        const finalThinking = thinkingBuf.current;
        contentBuf.current = '';
        thinkingBuf.current = '';

        if (finalContent) {
          const partialMsg: Message = {
            role: 'assistant',
            content: finalContent,
            thinkingTokens: finalThinking.length,
            timestamp: ts(),
          };
          const nextMessages = [...messagesRef.current, partialMsg];
          const newTokens = tokensRef.current + countTokens(finalContent) + countTokens(finalThinking);
          setMessages(nextMessages);
          setTokens(newTokens);
          saveCurrentSession(nextMessages, fullHistory.current, newTokens);
        } else {
          saveCurrentSession(messagesRef.current, fullHistory.current, tokensRef.current);
        }

        addSystem(`Error: ${err.message}`);
        setIsLoading(false);
        setLive({ content: '', thinking: '', thinkingChars: 0 });
        setLiveToolCalls([]);
      },
      onRoundLimit: async () => {
        return new Promise(resolve => {
          setContinueYes(true);
          setRoundLimitPending(true);
          roundLimitResolve.current = resolve;
        });
      },
      requestPermission,
    }, ac.signal);
  }, [addSystem, runCommand, requestPermission, scheduleFlush]);

  if (!splashDone) return <Splash onDone={() => setSplashDone(true)} />;

  if (showResume) {
    return (
      <ResumeSelector
        sessions={sessionsList}
        onSelect={(id) => activateSession(id)}
        onCancel={() => { setShowResume(false); if (!hasChat) startNewSession(); }}
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

      {isLoading && (
        <Box flexDirection="column">
          <ThinkingIndicator
            liveContent={live.content}
            liveThinkingText={live.thinking}
            liveThinkingChars={live.thinkingChars}
          />
          {liveToolCalls.map(tc => (
            <ToolCallBlock key={tc.id} tc={tc} />
          ))}
        </Box>
      )}

      {pendingPermission ? (
        <PermissionDialog
          toolName={pendingPermission.toolName}
          args={pendingPermission.args}
          onDecide={pendingPermission.resolve}
        />
      ) : roundLimitPending ? (
        <Box flexDirection="column">
          <Box flexDirection="column" paddingLeft={3} marginBottom={1}>
            <Text color="#F59E0B" bold>◆  Agent reached round limit. Continue?</Text>
            <Box gap={3} paddingLeft={2}>
              <Text color={continueYes ? '#10B981' : '#6B7280'} bold={continueYes}>{continueYes ? '▸ Yes' : '  Yes'}</Text>
              <Text color={!continueYes ? '#EF4444' : '#6B7280'} bold={!continueYes}>{!continueYes ? '▸ No' : '  No'}</Text>
            </Box>
          </Box>
          <StatusLine
            model="kimi-k2.6"
            mode={mode}
            tokens={tokens}
            contextPct={ctxPct}
          />
        </Box>
      ) : (
        <>
          <InputArea
            onSubmit={handleSubmit}
            isLoading={isLoading}
            exitPending={exitPending}
          />
          <StatusLine
            model="kimi-k2.6"
            mode={mode}
            tokens={tokens}
            contextPct={ctxPct}
          />
        </>
      )}
    </Box>
  );
}
