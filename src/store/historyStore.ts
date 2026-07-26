import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_HISTORY_SIZE } from '../utils/constants';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue, parseStoredStringArray } from '../utils/storeQueue';

interface HistoryStore {
  history: string[];
  loaded: boolean;
  loadError: boolean;
  loadHistory: () => Promise<void>;
  addToHistory: (key: string) => Promise<boolean>;
  removeFromHistory: (key: string) => Promise<boolean>;
  clearHistory: () => Promise<boolean>;
}

const queue = createStoreQueue();

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  loaded: false,
  loadError: false,

  loadHistory: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('keigo_history');
      } catch (e) {
        console.warn('Failed to load history:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        set({ loaded: true, loadError: false });
        return;
      }

      try {
        const parsed = parseStoredStringArray(stored);
        const history = [...new Set(parsed.filter(Boolean))].slice(0, MAX_HISTORY_SIZE);
        let recovered = true;
        if (JSON.stringify(history) !== stored) {
          recovered = await safeSetItem('keigo_history', JSON.stringify(history));
        }
        set({ history, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed history:', e);
        const removed = await safeRemoveItem('keigo_history');
        set({ history: [], loaded: true, loadError: !removed });
      }
    });
  },

  addToHistory: async (key: string): Promise<boolean> => {
    if (!get().loaded) await get().loadHistory();
    if (!get().loaded || !key) {
      console.warn('Skipping history update: store never loaded or key is invalid');
      return false;
    }

    let ok = false;
    await queue.enqueue(async () => {
      const current = get().history.filter((value) => value !== key);
      const updated = [key, ...current].slice(0, MAX_HISTORY_SIZE);
      const persisted = await safeSetItem('keigo_history', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist history');
        return;
      }
      set({ history: updated, loadError: false });
      ok = true;
    });
    return ok;
  },

  removeFromHistory: async (key: string): Promise<boolean> => {
    if (!get().loaded) await get().loadHistory();
    if (!get().loaded) {
      console.warn('Skipping history removal: store never loaded');
      return false;
    }

    let ok = false;
    await queue.enqueue(async () => {
      const updated = get().history.filter((value) => value !== key);
      const persisted = await safeSetItem('keigo_history', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist history removal');
        return;
      }
      set({ history: updated, loadError: false });
      ok = true;
    });
    return ok;
  },

  clearHistory: async (): Promise<boolean> => {
    if (!get().loaded) await get().loadHistory();
    if (!get().loaded) {
      console.warn('Skipping history clear: store never loaded');
      return false;
    }

    let ok = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem('keigo_history');
      if (!removed) {
        console.warn('Failed to clear history');
        return;
      }
      set({ history: [], loadError: false });
      ok = true;
    });
    return ok;
  },
}));

export function __resetHistoryStoreForTests() {
  queue.reset();
  useHistoryStore.setState({
    history: [],
    loaded: false,
    loadError: false,
  });
}
