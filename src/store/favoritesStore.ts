import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue, parseStoredStringArray } from '../utils/storeQueue';

interface FavoritesStore {
  favorites: string[];
  loaded: boolean;
  loadError: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (key: string) => Promise<boolean>;
  isFavorite: (key: string) => boolean;
}

const queue = createStoreQueue();

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  loaded: false,
  loadError: false,

  loadFavorites: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('favorites');
      } catch (e) {
        console.warn('Failed to load favorites:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        set({ loaded: true, loadError: false });
        return;
      }

      try {
        const parsed = parseStoredStringArray(stored);
        const favorites = [...new Set(parsed.filter(Boolean))];
        let recovered = true;
        if (JSON.stringify(favorites) !== stored) {
          recovered = await safeSetItem('favorites', JSON.stringify(favorites));
        }
        set({ favorites, loaded: true, loadError: !recovered });
      } catch (e) {
        console.warn('Resetting malformed favorites:', e);
        const removed = await safeRemoveItem('favorites');
        set({ favorites: [], loaded: true, loadError: !removed });
      }
    });
  },

  toggleFavorite: async (key: string): Promise<boolean> => {
    if (!get().loaded) await get().loadFavorites();
    if (!get().loaded || !key) {
      console.warn('Skipping favorite update: store never loaded or key is invalid');
      return false;
    }

    let ok = false;
    await queue.enqueue(async () => {
      const current = get().favorites;
      const updated = current.includes(key)
        ? current.filter((value) => value !== key)
        : [key, ...current];
      const persisted = await safeSetItem('favorites', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist favorites');
        return;
      }
      set({ favorites: updated, loadError: false });
      ok = true;
    });
    return ok;
  },

  isFavorite: (key: string) => {
    return get().favorites.includes(key);
  },
}));

export function __resetFavoritesStoreForTests() {
  queue.reset();
  useFavoritesStore.setState({
    favorites: [],
    loaded: false,
    loadError: false,
  });
}
