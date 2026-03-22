import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VerbWeight {
  [key: string]: number;
}

interface SpacedRepStore {
  weights: VerbWeight;
  loaded: boolean;
  loadWeights: () => Promise<void>;
  recordResult: (key: string, correct: boolean) => Promise<void>;
  getWeight: (key: string) => number;
}

const DEFAULT_WEIGHT = 1;
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 5;

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  loaded: false,

  loadWeights: async () => {
    try {
      const stored = await AsyncStorage.getItem('spaced_rep_weights');
      if (stored) {
        set({ weights: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load spaced rep weights:', e);
      set({ loaded: true });
    }
  },

  recordResult: async (key: string, correct: boolean) => {
    const weights = { ...get().weights };
    const current = weights[key] || DEFAULT_WEIGHT;

    if (correct) {
      weights[key] = Math.max(MIN_WEIGHT, current * 0.7);
    } else {
      weights[key] = Math.min(MAX_WEIGHT, current * 1.5);
    }

    set({ weights });
    await AsyncStorage.setItem('spaced_rep_weights', JSON.stringify(weights));
  },

  getWeight: (key: string) => {
    return get().weights[key] || DEFAULT_WEIGHT;
  },
}));
