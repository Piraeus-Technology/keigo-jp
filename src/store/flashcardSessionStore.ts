import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_DAILY_SESSIONS } from '../utils/constants';
import { getTodayKey, isValidDayKey } from '../utils/dayKey';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { isRecord, parsePersistedDay, toNonNegativeInteger } from '../utils/persistedData';

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
  saveSession: (session: Omit<FlashcardSession, 'day'>, day?: string) => Promise<boolean>;
  clearSessions: () => Promise<boolean>;
}

const queue = createStoreQueue();

function sanitizeSessions(value: unknown): {
  sessions: FlashcardSession[];
  changed: boolean;
} {
  if (!Array.isArray(value)) return { sessions: [], changed: true };

  const dayMap: Record<string, FlashcardSession> = {};
  let changed = false;
  value.forEach((raw) => {
    if (!isRecord(raw)) {
      changed = true;
      return;
    }

    const parsedDay = parsePersistedDay(raw);
    const reviewed = toNonNegativeInteger(raw.reviewed);
    const correct = toNonNegativeInteger(raw.correct);
    if (!parsedDay || reviewed === null || correct === null) {
      changed = true;
      return;
    }

    const safeCorrect = Math.min(correct, reviewed);
    if (
      parsedDay.migrated
      || reviewed !== raw.reviewed
      || safeCorrect !== raw.correct
    ) {
      changed = true;
    }

    const existing = dayMap[parsedDay.day];
    if (existing) {
      changed = true;
      existing.reviewed += reviewed;
      existing.correct += safeCorrect;
    } else {
      dayMap[parsedDay.day] = {
        day: parsedDay.day,
        reviewed,
        correct: safeCorrect,
      };
    }
  });

  const allSessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
  const sessions = allSessions.slice(0, MAX_DAILY_SESSIONS);
  if (sessions.length !== allSessions.length) changed = true;
  return { sessions, changed };
}

export const useFlashcardSessionStore = create<FlashcardSessionStore>((set, get) => ({
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
        stored = await AsyncStorage.getItem('flashcardSessions');
      } catch (e) {
        console.warn('Failed to load flashcard sessions:', e);
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
          recovered = await safeSetItem('flashcardSessions', JSON.stringify(sessions));
        }
        set({ sessions, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed flashcard sessions:', e);
        const removed = await safeRemoveItem('flashcardSessions');
        set({ sessions: [], loaded: true, loadError: !removed });
      }
    });
  },

  saveSession: async (session, day): Promise<boolean> => {
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      console.warn('Skipping flashcard session save: store never loaded');
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      const today = day ?? getTodayKey();
      const reviewed = toNonNegativeInteger(session.reviewed);
      const correct = toNonNegativeInteger(session.correct);
      if (!isValidDayKey(today) || reviewed === null || correct === null) {
        console.warn('Skipping invalid flashcard session');
        return;
      }
      const safeCorrect = Math.min(correct, reviewed);
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: FlashcardSession[];
      if (existingIndex >= 0) {
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          reviewed: updated[existingIndex].reviewed + reviewed,
          correct: updated[existingIndex].correct + safeCorrect,
        };
      } else {
        updated = [{ reviewed, correct: safeCorrect, day: today }, ...current];
      }
      updated.sort((a, b) => b.day.localeCompare(a.day));
      updated = updated.slice(0, MAX_DAILY_SESSIONS);

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
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem('flashcardSessions');
      if (!removed) {
        console.warn('Failed to clear flashcard sessions');
        return;
      }
      set({ sessions: [], loaded: true, loadError: false });
      ok = true;
    });
    return ok;
  },
}));

export function __resetFlashcardSessionStoreForTests() {
  queue.reset();
  useFlashcardSessionStore.setState({ sessions: [], loaded: false, loadError: false });
}
