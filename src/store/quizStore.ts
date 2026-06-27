import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface QuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  loaded: boolean;
  loadError: boolean;
  loadStats: () => Promise<void>;
  recordAnswer: (correct: boolean, currentStreak: number) => Promise<void>;
  resetStats: () => Promise<void>;
}

const queue = createStoreQueue();

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
      try {
        const stored = await AsyncStorage.getItem('quiz_stats');
        if (stored) {
          const data = JSON.parse(stored);
          set({ ...data, loaded: true, loadError: false });
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load quiz stats:', e);
        set({ loadError: true });
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
        bestStreak: Math.max(state.bestStreak, currentStreak),
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
      return;
    }
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('quiz_stats');
      if (!removed) {
        console.warn('Failed to reset quiz stats');
        return;
      }
      set({ totalQuestions: 0, totalCorrect: 0, bestStreak: 0, loaded: true, loadError: false });
    });
  },
}));

export function __resetQuizStoreForTests() {
  queue.reset();
  useQuizStore.setState({
    totalQuestions: 0,
    totalCorrect: 0,
    bestStreak: 0,
    loaded: false,
    loadError: false,
  });
}
