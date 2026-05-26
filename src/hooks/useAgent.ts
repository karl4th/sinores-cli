import { useState, useRef, useCallback, useEffect } from 'react';
import { runAgent, type ToolCallState, type Permission, type ChatMsg } from '../services/ai.js';
import { countTokens } from '../services/tokenizer.js';
import type { Message } from '../components/MessageBubble.js';
import type { ToolName } from '../services/tools.js';

const ts = () => new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

export interface LiveState {
  content: string;
  thinking: string;
  thinkingChars: number;
}

export interface PendingPermission {
  toolName: ToolName;
  args: Record<string, string>;
  resolve: (p: Permission) => void;
}

export interface RunResult {
  messages: Message[];
  tokens: number;
}

export function useAgent(
  addSystem: (msg: string) => void,
  saveSession: (msgs: Message[], hist: ChatMsg[], tok: number) => Promise<void>,
) {
  const [isLoading, setIsLoading] = useState(false);
  const [live, setLive] = useState<LiveState>({ content: '', thinking: '', thinkingChars: 0 });
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCallState[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [roundLimitPending, setRoundLimitPending] = useState(false);
  const [continueYes, setContinueYes] = useState(true);

  const pendingPermissionRef = useRef(pendingPermission);
  pendingPermissionRef.current = pendingPermission;

  const roundLimitResolve = useRef<(cont: boolean) => void>();
  const sessionAllowed = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const fullHistory = useRef<ChatMsg[]>([]);

  const contentBuf = useRef('');
  const thinkingBuf = useRef('');
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const stopAgent = useCallback(() => {
    abortRef.current?.abort();
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    setIsLoading(false);
    // Do NOT clear live/liveToolCalls here — let onDone/onError preserve
    // reasoning text by moving it into the assistant message bubble.
    pendingPermissionRef.current?.resolve('cancel');
    setPendingPermission(null);
    if (roundLimitResolve.current) {
      setRoundLimitPending(false);
      roundLimitResolve.current(false);
      roundLimitResolve.current = undefined;
    }
  }, [addSystem]);

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

  const runMessage = useCallback(async (
    sessionId: string | null,
    value: string,
    currentMessages: Message[],
    currentTokens: number,
  ): Promise<RunResult> => {
    setIsLoading(true);
    setLive({ content: '', thinking: '', thinkingChars: 0 });
    setLiveToolCalls([]);
    contentBuf.current = '';
    thinkingBuf.current = '';

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    fullHistory.current = [...fullHistory.current, { role: 'user', content: value }];

    return new Promise((resolve) => {
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
            content: finalContent || '',
            thinking: finalThinking || undefined,
            thinkingTokens: thinkingChars,
            timestamp: ts(),
          };

          const nextMessages = [...currentMessages, newMsg];
          const newTokens = currentTokens + countTokens(finalContent) + countTokens(finalThinking);

          setIsLoading(false);
          setLive({ content: '', thinking: '', thinkingChars: 0 });
          setLiveToolCalls([]);

          saveSession(nextMessages, updatedHistory, newTokens).catch(() => {});
          resolve({ messages: nextMessages, tokens: newTokens });
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

          let nextMessages = currentMessages;
          let newTokens = currentTokens;

          if (finalContent) {
            const assistantMsg: ChatMsg = {
              role: 'assistant',
              content: finalContent,
            };
            if (finalThinking) {
              (assistantMsg as any).reasoning_content = finalThinking;
            }
            fullHistory.current = [...fullHistory.current, assistantMsg];

            const partialMsg: Message = {
              role: 'assistant',
              content: finalContent,
              thinking: finalThinking || undefined,
              thinkingTokens: finalThinking.length,
              timestamp: ts(),
            };
            nextMessages = [...currentMessages, partialMsg];
            newTokens = currentTokens + countTokens(finalContent) + countTokens(finalThinking);
          }

          const errMsg: Message = { role: 'system', content: `Error: ${err.message}`, timestamp: ts() };
          nextMessages = [...nextMessages, errMsg];
          saveSession(nextMessages, fullHistory.current, newTokens).catch(() => {});

          setIsLoading(false);
          setLive({ content: '', thinking: '', thinkingChars: 0 });
          setLiveToolCalls([]);
          resolve({ messages: nextMessages, tokens: newTokens });
        },
        onRoundLimit: async () => {
          return new Promise(resolve => {
            setContinueYes(true);
            setRoundLimitPending(true);
            roundLimitResolve.current = resolve;
          });
        },
        requestPermission,
      }, ac.signal, sessionId ?? undefined);
    });
  }, [addSystem, saveSession, scheduleFlush, requestPermission]);

  // Cleanup flush timer on unmount
  useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      abortRef.current?.abort();
    };
  }, []);

  return {
    isLoading,
    live,
    liveToolCalls,
    pendingPermission,
    roundLimitPending,
    continueYes,
    fullHistory,
    stopAgent,
    runMessage,
    setContinueYes,
    resolveRoundLimit: (value: boolean) => {
      setRoundLimitPending(false);
      roundLimitResolve.current?.(value);
      roundLimitResolve.current = undefined;
    },
  };
}
