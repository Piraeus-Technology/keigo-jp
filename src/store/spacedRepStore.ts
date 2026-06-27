import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface VerbWeight {
  [key: string]: number;
}

interface SpacedRepStore {
  weights: VerbWeight;
  loaded: boolean;
  loadError: boolean;
  loadWeights: () => Promise<void>;
  recordResult: (key: string, correct: boolean) => Promise<void>;
  getWeight: (key: string) => number;
  resetWeights: () => Promise<void>;
}

const DEFAULT_WEIGHT = 1;
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 5;

const queue = createStoreQueue();

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  loaded: false,
  loadError: false,

  loadWeights: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('spaced_rep_weights');
        if (stored) {
          set({ weights: JSON.parse(stored), loaded: true, loadError: false });
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load spaced rep weights:', e);
        set({ loadError: true });
      }
    });
  },

  recordResult: async (key: string, correct: boolean) => {
    if (!get().loaded) {
      await get().loadWeights();
    }
    if (!get().loaded) {
      console.warn('Skipping spaced rep update: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const weights = { ...get().weights };
      const current = weights[key] || DEFAULT_WEIGHT;
      weights[key] = correct
        ? Math.max(MIN_WEIGHT, current * 0.7)
        : Math.min(MAX_WEIGHT, current * 1.5);

      const persisted = await safeSetItem('spaced_rep_weights', JSON.stringify(weights));
      if (!persisted) {
        console.warn('Failed to persist spaced rep weights');
        return;
      }
      set({ weights });
    });
  },

  getWeight: (key: string) => get().weights[key] || DEFAULT_WEIGHT,

  resetWeights: async () => {
    if (!get().loaded) {
      await get().loadWeights();
    }
    if (!get().loaded) {
      console.warn('Skipping spaced rep reset: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const removed = await safeRemoveItem('spaced_rep_weights');
      if (!removed) {
        console.warn('Failed to reset spaced rep weights');
        return;
      }
      set({ weights: {}, loaded: true, loadError: false });
    });
  },
}));

export function __resetSpacedRepStoreForTests() {
  queue.reset();
  useSpacedRepStore.setState({ weights: {}, loaded: false, loadError: false });
}
