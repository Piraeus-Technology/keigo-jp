import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_HISTORY_SIZE } from '../utils/constants';

interface HistoryStore {
  history: string[];
  loaded: boolean;
  loadHistory: () => Promise<void>;
  addToHistory: (key: string) => Promise<void>;
  removeFromHistory: (key: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  loaded: false,

  loadHistory: async () => {
    try {
      const stored = await AsyncStorage.getItem('keigo_history');
      if (stored) {
        set({ history: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
      set({ loaded: true });
    }
  },

  addToHistory: async (key: string) => {
    const current = get().history.filter((v) => v !== key);
    const updated = [key, ...current].slice(0, MAX_HISTORY_SIZE);
    set({ history: updated });
    await AsyncStorage.setItem('keigo_history', JSON.stringify(updated));
  },

  removeFromHistory: async (key: string) => {
    const updated = get().history.filter((v) => v !== key);
    set({ history: updated });
    await AsyncStorage.setItem('keigo_history', JSON.stringify(updated));
  },

  clearHistory: async () => {
    set({ history: [] });
    await AsyncStorage.removeItem('keigo_history');
  },
}));
