import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { isRecord, toNonNegativeInteger } from '../utils/persistedData';

interface QuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  loaded: boolean;
  loadError: boolean;
  loadStats: () => Promise<void>;
  recordAnswer: (correct: boolean, currentStreak: number) => Promise<void>;
  resetStats: () => Promise<boolean>;
}

const queue = createStoreQueue();
const EMPTY_STATS = {
  totalQuestions: 0,
  totalCorrect: 0,
  bestStreak: 0,
};

function sanitizeStats(value: unknown): {
  stats: typeof EMPTY_STATS;
  changed: boolean;
} {
  if (!isRecord(value)) return { stats: { ...EMPTY_STATS }, changed: true };

  const totalQuestions = toNonNegativeInteger(value.totalQuestions);
  const totalCorrect = toNonNegativeInteger(value.totalCorrect);
  const bestStreak = toNonNegativeInteger(value.bestStreak);
  if (totalQuestions === null || totalCorrect === null || bestStreak === null) {
    return { stats: { ...EMPTY_STATS }, changed: true };
  }

  const stats = {
    totalQuestions,
    totalCorrect: Math.min(totalCorrect, totalQuestions),
    bestStreak,
  };
  return {
    stats,
    changed:
      stats.totalQuestions !== value.totalQuestions
      || stats.totalCorrect !== value.totalCorrect
      || stats.bestStreak !== value.bestStreak,
  };
}

export const useQuizStore = create<QuizStats>((set, get) => ({
  totalQuestions: 0,
  totalCorrect: 0,
  bestStreak: 0,
  loaded: false,
  loadError: false,

  loadStats: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('quiz_stats');
      } catch (e) {
        console.warn('Failed to load quiz stats:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        set({ loaded: true, loadError: false });
        return;
      }

      try {
        const { stats, changed } = sanitizeStats(JSON.parse(stored));
        let recovered = true;
        if (changed) {
          recovered = await safeSetItem('quiz_stats', JSON.stringify(stats));
        }
        set({ ...stats, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed quiz stats:', e);
        const removed = await safeRemoveItem('quiz_stats');
        set({ ...EMPTY_STATS, loaded: true, loadError: !removed });
      }
    });
  },

  recordAnswer: async (correct: boolean, currentStreak: number) => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) {
      console.warn('Skipping quiz answer persistence: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const state = get();
      const updated = {
        totalQuestions: state.totalQuestions + 1,
        totalCorrect: state.totalCorrect + (correct ? 1 : 0),
        bestStreak: Math.max(state.bestStreak, toNonNegativeInteger(currentStreak) ?? 0),
      };
      const persisted = await safeSetItem('quiz_stats', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist quiz stats');
        return;
      }
      set(updated);
    });
  },

  resetStats: async () => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) {
      console.warn('Skipping quiz stats reset: store never loaded');
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem('quiz_stats');
      if (!removed) {
        console.warn('Failed to reset quiz stats');
        return;
      }
      set({ totalQuestions: 0, totalCorrect: 0, bestStreak: 0, loaded: true, loadError: false });
      ok = true;
    });
    return ok;
  },
}));

export function __resetQuizStoreForTests() {
  queue.reset();
  useQuizStore.setState({
    ...EMPTY_STATS,
    loaded: false,
    loadError: false,
  });
}
