import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { isRecord, toNonNegativeInteger } from '../utils/persistedData';

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
const EMPTY_STATS = { totalReviewed: 0, totalCorrect: 0 };

function sanitizeStats(value: unknown): {
  stats: typeof EMPTY_STATS;
  changed: boolean;
} {
  if (!isRecord(value)) return { stats: { ...EMPTY_STATS }, changed: true };
  const totalReviewed = toNonNegativeInteger(value.totalReviewed);
  const totalCorrect = toNonNegativeInteger(value.totalCorrect);
  if (totalReviewed === null || totalCorrect === null) {
    return { stats: { ...EMPTY_STATS }, changed: true };
  }
  const stats = {
    totalReviewed,
    totalCorrect: Math.min(totalCorrect, totalReviewed),
  };
  return {
    stats,
    changed:
      stats.totalReviewed !== value.totalReviewed
      || stats.totalCorrect !== value.totalCorrect,
  };
}

async function seedStatsFromSessions(): Promise<{ totalReviewed: number; totalCorrect: number }> {
  const seed = { ...EMPTY_STATS };
  try {
    const stored = await AsyncStorage.getItem('flashcardSessions');
    if (!stored) return seed;

    const sessions = JSON.parse(stored);
    if (!Array.isArray(sessions)) return seed;

    return sessions.reduce((totals, session) => {
      if (!isRecord(session)) return totals;
      const reviewed = toNonNegativeInteger(session.reviewed);
      const correct = toNonNegativeInteger(session.correct);
      if (reviewed === null || correct === null) return totals;
      return {
        totalReviewed: totals.totalReviewed + reviewed,
        totalCorrect: totals.totalCorrect + Math.min(correct, reviewed),
      };
    }, seed);
  } catch (e) {
    console.warn('Failed to seed flashcard stats from sessions:', e);
    return seed;
  }
}

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
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('flashcard_stats');
      } catch (e) {
        console.warn('Failed to load flashcard stats:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        const seeded = await seedStatsFromSessions();
        const persisted = await safeSetItem('flashcard_stats', JSON.stringify(seeded));
        if (!persisted) console.warn('Failed to persist seeded flashcard stats');
        set({ ...seeded, loaded: true, loadError: !persisted });
        return;
      }

      try {
        const { stats, changed } = sanitizeStats(JSON.parse(stored));
        let recovered = true;
        if (changed) {
          recovered = await safeSetItem('flashcard_stats', JSON.stringify(stats));
        }
        set({ ...stats, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed flashcard stats:', e);
        const seeded = await seedStatsFromSessions();
        const recovered = await safeSetItem('flashcard_stats', JSON.stringify(seeded));
        set({ ...seeded, loaded: true, loadError: !recovered });
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
    ...EMPTY_STATS,
    loaded: false,
    loadError: false,
  });
}
