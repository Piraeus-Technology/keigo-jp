import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import { isRecord } from '../utils/persistedData';

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
  resetWeights: () => Promise<boolean>;
}

const DEFAULT_WEIGHT = 1;
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 5;

const queue = createStoreQueue();

function sanitizeWeights(value: unknown): { weights: VerbWeight; changed: boolean } {
  if (!isRecord(value)) return { weights: {}, changed: true };

  const weights: VerbWeight = {};
  let changed = false;
  Object.entries(value).forEach(([key, weight]) => {
    if (!key || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      changed = true;
      return;
    }
    const clamped = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, weight));
    weights[key] = clamped;
    if (clamped !== weight) changed = true;
  });
  return { weights, changed };
}

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  loaded: false,
  loadError: false,

  loadWeights: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('spaced_rep_weights');
      } catch (e) {
        console.warn('Failed to load spaced rep weights:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        set({ loaded: true, loadError: false });
        return;
      }

      try {
        const { weights, changed } = sanitizeWeights(JSON.parse(stored));
        let recovered = true;
        if (changed) {
          recovered = await safeSetItem('spaced_rep_weights', JSON.stringify(weights));
        }
        set({ weights, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed spaced rep weights:', e);
        const removed = await safeRemoveItem('spaced_rep_weights');
        set({ weights: {}, loaded: true, loadError: !removed });
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
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem('spaced_rep_weights');
      if (!removed) {
        console.warn('Failed to reset spaced rep weights');
        return;
      }
      set({ weights: {}, loaded: true, loadError: false });
      ok = true;
    });
    return ok;
  },
}));

export function __resetSpacedRepStoreForTests() {
  queue.reset();
  useSpacedRepStore.setState({ weights: {}, loaded: false, loadError: false });
}
