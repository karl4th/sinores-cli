import { useRef, useState, useCallback } from 'react';
import {
  generateSessionId,
  listSessions,
  loadSession as loadSessionData,
  saveSession as saveSessionData,
  clearCurrentSession as clearCurrentSessionFile,
  deleteSession,
  type SessionMeta,
} from '../services/session.js';
import { CWD } from '../services/tools.js';
import type { Message } from '../components/MessageBubble.js';
import type { ChatMsg } from '../services/ai.js';

export function useSession(addSystem: (content: string) => void) {
  const sessionMeta = useRef<{ id: string; name: string; createdAt: string } | null>(null);
  const [showResume, setShowResume] = useState(false);
  const [sessionsList, setSessionsList] = useState<SessionMeta[]>([]);

  const startNewSession = useCallback((name?: string) => {
    const id = generateSessionId();
    const now = new Date().toISOString();
    sessionMeta.current = { id, name: name || '', createdAt: now };
  }, []);

  const openResumeSelector = useCallback(async () => {
    const list = await listSessions(CWD);
    if (list.length === 0) {
      addSystem('No saved sessions found for this project. Starting fresh.');
      startNewSession();
      return false;
    }
    setSessionsList(list);
    setShowResume(true);
    return true;
  }, [addSystem, startNewSession]);

  const saveCurrentSession = useCallback(async (msgs: Message[], hist: ChatMsg[], tok: number) => {
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
      projectPath: CWD,
      createdAt: sessionMeta.current.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const activateSession = useCallback(async (id: string) => {
    const data = await loadSessionData(id);
    if (!data) {
      addSystem('Failed to load session.');
      setShowResume(false);
      return null;
    }
    sessionMeta.current = { id: data.id, name: data.name, createdAt: data.createdAt };
    setShowResume(false);
    return data;
  }, [addSystem]);

  const clearAndRestart = useCallback(() => {
    const oldId = sessionMeta.current?.id;
    clearCurrentSessionFile();
    if (oldId) deleteSession(oldId);
    startNewSession();
  }, [startNewSession]);

  return {
    sessionMeta,
    showResume,
    setShowResume,
    sessionsList,
    startNewSession,
    openResumeSelector,
    saveCurrentSession,
    activateSession,
    clearAndRestart,
  };
}
