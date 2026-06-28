import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_DAILY_SESSIONS } from '../utils/constants';
import { getTodayKey, normalizeStoredDayKey, timestampToDayKey } from '../utils/dayKey';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

export interface FlashcardSession {
  day: string; // 'YYYY-MM-DD'
  reviewed: number;
  correct: number;
}

interface FlashcardSessionStore {
  sessions: FlashcardSession[];
  loaded: boolean;
  loadError: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<FlashcardSession, 'day'>) => Promise<boolean>;
  clearSessions: () => Promise<void>;
}

const queue = createStoreQueue();

export const useFlashcardSessionStore = create<FlashcardSessionStore>((set, get) => ({
  sessions: [],
  loaded: false,
  loadError: false,

  loadSessions: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('flashcardSessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          const dayMap: Record<string, FlashcardSession> = {};
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
              dayMap[day].reviewed += s.reviewed;
              dayMap[day].correct += s.correct;
            } else {
              dayMap[day] = { day, reviewed: s.reviewed, correct: s.correct };
            }
          }
          const sessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
          set({ sessions, loaded: true, loadError: false });
          if (didMigrate) {
            await safeSetItem('flashcardSessions', JSON.stringify(sessions));
          }
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load flashcard sessions:', e);
        set({ loadError: true });
      }
    });
  },

  saveSession: async (session): Promise<boolean> => {
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      console.warn('Skipping flashcard session save: store never loaded');
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      const today = getTodayKey();
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: FlashcardSession[];
      if (existingIndex >= 0) {
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          reviewed: updated[existingIndex].reviewed + session.reviewed,
          correct: updated[existingIndex].correct + session.correct,
        };
      } else {
        updated = [{ ...session, day: today }, ...current].slice(0, MAX_DAILY_SESSIONS);
      }

      const persisted = await safeSetItem('flashcardSessions', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist flashcard session');
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
      console.warn('Skipping flashcard session clear: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('flashcardSessions');
      if (!removed) {
        console.warn('Failed to clear flashcard sessions');
        return;
      }
      set({ sessions: [], loaded: true, loadError: false });
    });
  },
}));

export function __resetFlashcardSessionStoreForTests() {
  queue.reset();
  useFlashcardSessionStore.setState({ sessions: [], loaded: false, loadError: false });
}
