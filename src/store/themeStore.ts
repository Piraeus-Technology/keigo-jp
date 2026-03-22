import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeStore {
  isDark: boolean;
  loaded: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  loaded: false,

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem('theme_mode');
      if (stored === 'dark') {
        set({ isDark: true, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load theme:', e);
      set({ loaded: true });
    }
  },

  toggleTheme: async () => {
    const newIsDark = !get().isDark;
    set({ isDark: newIsDark });
    await AsyncStorage.setItem('theme_mode', newIsDark ? 'dark' : 'light');
  },
}));
