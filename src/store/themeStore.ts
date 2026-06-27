import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface ThemeStore {
  isDark: boolean;
  autoTTS: boolean;
  loaded: boolean;
  loadError: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  toggleAutoTTS: () => Promise<void>;
}

const queue = createStoreQueue();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  autoTTS: false,
  loaded: false,
  loadError: false,

  loadTheme: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const [stored, tts] = await Promise.all([
          AsyncStorage.getItem('theme_mode'),
          AsyncStorage.getItem('auto_tts'),
        ]);
        set({ isDark: stored === 'dark', autoTTS: tts === 'true', loaded: true, loadError: false });
      } catch (e) {
        console.warn('Failed to load theme:', e);
        // Theme gates App.tsx's first render, so recoverable preference-load
        // failures must still mark loaded and fall back to defaults.
        set({ loaded: true, loadError: true });
      }
    });
  },

  toggleTheme: async () => {
    if (!get().loaded) {
      await get().loadTheme();
    }
    if (!get().loaded) {
      console.warn('Skipping theme toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const newIsDark = !get().isDark;
      const persisted = await safeSetItem('theme_mode', newIsDark ? 'dark' : 'light');
      if (!persisted) {
        console.warn('Theme preference not persisted');
        return;
      }
      set({ isDark: newIsDark });
    });
  },

  toggleAutoTTS: async () => {
    if (!get().loaded) {
      await get().loadTheme();
    }
    if (!get().loaded) {
      console.warn('Skipping auto-play toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const newAutoTTS = !get().autoTTS;
      const persisted = await safeSetItem('auto_tts', newAutoTTS ? 'true' : 'false');
      if (!persisted) {
        console.warn('Auto-play preference not persisted');
        return;
      }
      set({ autoTTS: newAutoTTS });
    });
  },
}));

export function __resetThemeStoreForTests() {
  queue.reset();
  useThemeStore.setState({ isDark: false, autoTTS: false, loaded: false, loadError: false });
}
