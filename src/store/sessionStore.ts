import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_DAILY_SESSIONS } from '../utils/constants';
import { getTodayKey, isValidDayKey } from '../utils/dayKey';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { isRecord, parsePersistedDay, toNonNegativeInteger } from '../utils/persistedData';

export interface Session {
  day: string; // 'YYYY-MM-DD'
  total: number;
  correct: number;
  streak: number;
}

interface SessionStore {
  sessions: Session[];
  loaded: boolean;
  loadError: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<Session, 'day'>, day?: string) => Promise<boolean>;
  clearSessions: () => Promise<void>;
}

const queue = createStoreQueue();

function sanitizeSessions(value: unknown): { sessions: Session[]; changed: boolean } {
  if (!Array.isArray(value)) return { sessions: [], changed: true };

  const dayMap: Record<string, Session> = {};
  let changed = false;
  value.forEach((raw) => {
    if (!isRecord(raw)) {
      changed = true;
      return;
    }

    const parsedDay = parsePersistedDay(raw);
    const total = toNonNegativeInteger(raw.total);
    const correct = toNonNegativeInteger(raw.correct);
    const streak = toNonNegativeInteger(raw.streak ?? 0);
    if (!parsedDay || total === null || correct === null || streak === null) {
      changed = true;
      return;
    }

    const safeCorrect = Math.min(correct, total);
    if (
      parsedDay.migrated
      || safeCorrect !== raw.correct
      || total !== raw.total
      || streak !== raw.streak
    ) {
      changed = true;
    }

    const existing = dayMap[parsedDay.day];
    if (existing) {
      changed = true;
      existing.total += total;
      existing.correct += safeCorrect;
      existing.streak = Math.max(existing.streak, streak);
    } else {
      dayMap[parsedDay.day] = {
        day: parsedDay.day,
        total,
        correct: safeCorrect,
        streak,
      };
    }
  });

  const allSessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
  const sessions = allSessions.slice(0, MAX_DAILY_SESSIONS);
  if (sessions.length !== allSessions.length) changed = true;
  return { sessions, changed };
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  loaded: false,
  loadError: false,

  loadSessions: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('sessions');
      } catch (e) {
        console.warn('Failed to load sessions:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        set({ loaded: true, loadError: false });
        return;
      }

      try {
        const { sessions, changed } = sanitizeSessions(JSON.parse(stored));
        let recovered = true;
        if (changed) {
          recovered = await safeSetItem('sessions', JSON.stringify(sessions));
        }
        set({ sessions, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed sessions:', e);
        const removed = await safeRemoveItem('sessions');
        set({ sessions: [], loaded: true, loadError: !removed });
      }
    });
  },

  saveSession: async (session, day): Promise<boolean> => {
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      console.warn('Skipping quiz session save: store never loaded');
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      const today = day ?? getTodayKey();
      const total = toNonNegativeInteger(session.total);
      const correct = toNonNegativeInteger(session.correct);
      const streak = toNonNegativeInteger(session.streak);
      if (!isValidDayKey(today) || total === null || correct === null || streak === null) {
        console.warn('Skipping invalid quiz session');
        return;
      }
      const safeCorrect = Math.min(correct, total);
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: Session[];
      if (existingIndex >= 0) {
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          total: updated[existingIndex].total + total,
          correct: updated[existingIndex].correct + safeCorrect,
          streak: Math.max(updated[existingIndex].streak, streak),
        };
      } else {
        updated = [{ total, correct: safeCorrect, streak, day: today }, ...current];
      }
      updated.sort((a, b) => b.day.localeCompare(a.day));
      updated = updated.slice(0, MAX_DAILY_SESSIONS);

      const persisted = await safeSetItem('sessions', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist quiz session');
        return;
      }
      set({ sessions: updated });
      ok = true;
    });
    return ok;
  },

  clearSessions: async () => {
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      console.warn('Skipping quiz session clear: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('sessions');
      if (!removed) {
        console.warn('Failed to clear quiz sessions');
        return;
      }
      set({ sessions: [], loaded: true, loadError: false });
    });
  },
}));

export function __resetSessionStoreForTests() {
  queue.reset();
  useSessionStore.setState({ sessions: [], loaded: false, loadError: false });
}
