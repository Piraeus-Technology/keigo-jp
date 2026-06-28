import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_DAILY_SESSIONS } from '../utils/constants';
import { getTodayKey, normalizeStoredDayKey, timestampToDayKey } from '../utils/dayKey';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

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

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  loaded: false,
  loadError: false,

  loadSessions: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          const dayMap: Record<string, Session> = {};
          let didMigrate = false;
          for (const s of parsed) {
            let day: string;
            if (s.day) {
              day = normalizeStoredDayKey(s.day);
              if (day !== s.day) didMigrate = true;
            } else {
              didMigrate = true;
              day = timestampToDayKey(s.date);
            }
            if (dayMap[day]) {
              didMigrate = true;
              dayMap[day].total += s.total;
              dayMap[day].correct += s.correct;
              dayMap[day].streak = Math.max(dayMap[day].streak, s.streak || 0);
            } else {
              dayMap[day] = { day, total: s.total, correct: s.correct, streak: s.streak || 0 };
            }
          }
          const sessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
          set({ sessions, loaded: true, loadError: false });
          if (didMigrate) {
            await safeSetItem('sessions', JSON.stringify(sessions));
          }
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load sessions:', e);
        set({ loadError: true });
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
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: Session[];
      if (existingIndex >= 0) {
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          total: updated[existingIndex].total + session.total,
          correct: updated[existingIndex].correct + session.correct,
          streak: Math.max(updated[existingIndex].streak, session.streak),
        };
      } else {
        updated = [{ ...session, day: today }, ...current].slice(0, MAX_DAILY_SESSIONS);
      }

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
