import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface QuizStats {
  totalQuestions: number;
  totalCorrect: number;
  bestStreak: number;
  loaded: boolean;
  loadStats: () => Promise<void>;
  recordAnswer: (correct: boolean, currentStreak: number) => Promise<void>;
  resetStats: () => Promise<void>;
}

export const useQuizStore = create<QuizStats>((set, get) => ({
  totalQuestions: 0,
  totalCorrect: 0,
  bestStreak: 0,
  loaded: false,

  loadStats: async () => {
    try {
      const stored = await AsyncStorage.getItem('quiz_stats');
      if (stored) {
        const data = JSON.parse(stored);
        set({ ...data, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load quiz stats:', e);
      set({ loaded: true });
    }
  },

  recordAnswer: async (correct: boolean, currentStreak: number) => {
    const state = get();
    const updated = {
      totalQuestions: state.totalQuestions + 1,
      totalCorrect: state.totalCorrect + (correct ? 1 : 0),
      bestStreak: Math.max(state.bestStreak, currentStreak),
    };
    set(updated);
    await AsyncStorage.setItem('quiz_stats', JSON.stringify(updated));
  },

  resetStats: async () => {
    set({ totalQuestions: 0, totalCorrect: 0, bestStreak: 0 });
    await AsyncStorage.removeItem('quiz_stats');
  },
}));
