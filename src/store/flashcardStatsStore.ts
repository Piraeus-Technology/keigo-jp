import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

// Lifetime flashcard aggregate, mirroring quizStore. Kept separate from the
// day-keyed flashcardSessionStore (capped at 365 days) so "all time" totals
// don't silently become a rolling-year window.
interface FlashcardStats {
  totalReviewed: number;
  totalCorrect: number;
  loaded: boolean;
  loadError: boolean;
  loadStats: () => Promise<void>;
  recordReview: (correct: boolean) => Promise<void>;
  resetStats: () => Promise<void>;
}

const queue = createStoreQueue();

export const useFlashcardStatsStore = create<FlashcardStats>((set, get) => ({
  totalReviewed: 0,
  totalCorrect: 0,
  loaded: false,
  loadError: false,

  loadStats: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('flashcard_stats');
        if (stored) {
          const data = JSON.parse(stored);
          set({ ...data, loaded: true, loadError: false });
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load flashcard stats:', e);
        set({ loadError: true });
      }
    });
  },

  recordReview: async (correct: boolean) => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) {
      console.warn('Skipping flashcard stat persistence: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const state = get();
      const updated = {
        totalReviewed: state.totalReviewed + 1,
        totalCorrect: state.totalCorrect + (correct ? 1 : 0),
      };
      const persisted = await safeSetItem('flashcard_stats', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist flashcard stats');
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
      console.warn('Skipping flashcard stats reset: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('flashcard_stats');
      if (!removed) {
        console.warn('Failed to reset flashcard stats');
        return;
      }
      set({ totalReviewed: 0, totalCorrect: 0, loaded: true, loadError: false });
    });
  },
}));

export function __resetFlashcardStatsStoreForTests() {
  queue.reset();
  useFlashcardStatsStore.setState({
    totalReviewed: 0,
    totalCorrect: 0,
    loaded: false,
    loadError: false,
  });
}
