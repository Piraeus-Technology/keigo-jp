import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeigoForm, BusinessLevel, ALL_LEVELS } from '../utils/keigoTypes';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

// Only sonkeigo + kenjougo are quizzed/drilled — teineigo is usually just the
// です/ます polite form and not a meaningful multiple-choice target.
const allForms: KeigoForm[] = ['sonkeigo', 'kenjougo'];
const allLevels: BusinessLevel[] = [...ALL_LEVELS];

interface PracticeSettingsStore {
  activeForms: KeigoForm[];
  activeLevels: BusinessLevel[];
  includeExpressions: boolean;
  loaded: boolean;
  loadError: boolean;
  loadPracticeSettings: () => Promise<void>;
  setActiveForms: (forms: KeigoForm[]) => Promise<void>;
  setActiveLevels: (levels: BusinessLevel[]) => Promise<void>;
  toggleForm: (form: KeigoForm) => Promise<void>;
  toggleLevel: (level: BusinessLevel) => Promise<void>;
  toggleIncludeExpressions: () => Promise<void>;
}

const queue = createStoreQueue();

function parseStoredSubset<T>(value: unknown, valid: T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => valid.includes(item as T));
}

function safeForms(forms: KeigoForm[]): KeigoForm[] {
  const valid = parseStoredSubset(forms, allForms);
  return valid.length > 0 ? valid : ['sonkeigo'];
}

function safeLevels(levels: BusinessLevel[]): BusinessLevel[] {
  const valid = parseStoredSubset(levels, allLevels);
  return valid.length > 0 ? valid : ['basic'];
}

async function persist(state: {
  activeForms: KeigoForm[];
  activeLevels: BusinessLevel[];
  includeExpressions: boolean;
}): Promise<boolean> {
  return safeSetItem('practiceSettings', JSON.stringify(state));
}

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => ({
  activeForms: [...allForms],
  activeLevels: [...allLevels],
  includeExpressions: true,
  loaded: false,
  loadError: false,

  loadPracticeSettings: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('practiceSettings');
        const parsed = stored ? JSON.parse(stored) : {};
        const forms = parseStoredSubset(parsed?.activeForms, allForms);
        const levels = parseStoredSubset(parsed?.activeLevels, allLevels);
        set({
          activeForms: forms.length > 0 ? forms : [...allForms],
          activeLevels: levels.length > 0 ? levels : [...allLevels],
          includeExpressions:
            typeof parsed?.includeExpressions === 'boolean' ? parsed.includeExpressions : true,
          loaded: true,
          loadError: false,
        });
      } catch (e) {
        console.warn('Failed to load practice settings:', e);
        set({ loadError: true });
      }
    });
  },

  setActiveForms: async (forms) => {
    if (!get().loaded) await get().loadPracticeSettings();
    if (!get().loaded) {
      console.warn('Skipping practice form update: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const next = safeForms(forms);
      const state = get();
      const ok = await persist({
        activeForms: next,
        activeLevels: state.activeLevels,
        includeExpressions: state.includeExpressions,
      });
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeForms: next });
    });
  },

  setActiveLevels: async (levels) => {
    if (!get().loaded) await get().loadPracticeSettings();
    if (!get().loaded) {
      console.warn('Skipping practice level update: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const next = safeLevels(levels);
      const state = get();
      const ok = await persist({
        activeForms: state.activeForms,
        activeLevels: next,
        includeExpressions: state.includeExpressions,
      });
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeLevels: next });
    });
  },

  toggleForm: async (form) => {
    if (!get().loaded) await get().loadPracticeSettings();
    if (!get().loaded) {
      console.warn('Skipping practice form toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().activeForms;
      let updated: KeigoForm[];
      if (current.includes(form)) {
        if (current.length <= 1) return;
        updated = current.filter(f => f !== form);
      } else {
        updated = [...current, form];
      }
      const state = get();
      const ok = await persist({
        activeForms: updated,
        activeLevels: state.activeLevels,
        includeExpressions: state.includeExpressions,
      });
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeForms: updated });
    });
  },

  toggleLevel: async (level) => {
    if (!get().loaded) await get().loadPracticeSettings();
    if (!get().loaded) {
      console.warn('Skipping practice level toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().activeLevels;
      let updated: BusinessLevel[];
      if (current.includes(level)) {
        if (current.length <= 1) return;
        updated = current.filter(l => l !== level);
      } else {
        updated = [...current, level];
      }
      const state = get();
      const ok = await persist({
        activeForms: state.activeForms,
        activeLevels: updated,
        includeExpressions: state.includeExpressions,
      });
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeLevels: updated });
    });
  },

  toggleIncludeExpressions: async () => {
    if (!get().loaded) await get().loadPracticeSettings();
    if (!get().loaded) {
      console.warn('Skipping include-expressions toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const next = !get().includeExpressions;
      const state = get();
      const ok = await persist({
        activeForms: state.activeForms,
        activeLevels: state.activeLevels,
        includeExpressions: next,
      });
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ includeExpressions: next });
    });
  },
}));

export function __resetPracticeSettingsStoreForTests() {
  queue.reset();
  usePracticeSettingsStore.setState({
    activeForms: [...allForms],
    activeLevels: [...allLevels],
    includeExpressions: true,
    loaded: false,
    loadError: false,
  });
}

export { allForms, allLevels };
