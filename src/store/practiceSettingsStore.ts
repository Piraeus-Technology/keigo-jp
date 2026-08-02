import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeigoForm,
  BusinessLevel,
  PromptLanguage,
  ALL_LEVELS,
  GRADABLE_FORMS,
  PROMPT_LANGUAGES,
} from '../utils/keigoTypes';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

// Only sonkeigo + kenjougo are quizzed/drilled — teineigo is usually just the
// です/ます polite form and not a meaningful multiple-choice target.
const allForms: KeigoForm[] = [...GRADABLE_FORMS];
const allLevels: BusinessLevel[] = [...ALL_LEVELS];

interface PersistedPracticeSettings {
  activeForms: KeigoForm[];
  activeLevels: BusinessLevel[];
  includeExpressions: boolean;
  promptLanguage: PromptLanguage;
}

interface PracticeSettingsStore extends PersistedPracticeSettings {
  loaded: boolean;
  loadError: boolean;
  loadPracticeSettings: () => Promise<void>;
  setActiveForms: (forms: KeigoForm[]) => Promise<void>;
  setActiveLevels: (levels: BusinessLevel[]) => Promise<void>;
  toggleForm: (form: KeigoForm) => Promise<void>;
  toggleLevel: (level: BusinessLevel) => Promise<void>;
  toggleIncludeExpressions: () => Promise<void>;
  setPromptLanguage: (language: PromptLanguage) => Promise<void>;
}

const queue = createStoreQueue();

const defaultSettings = (): PersistedPracticeSettings => ({
  activeForms: [...allForms],
  activeLevels: [...allLevels],
  includeExpressions: true,
  promptLanguage: 'both',
});

// Persisted keys are written in a fixed order so the load path can compare the
// re-serialized settings against the stored blob byte for byte.
function snapshot(
  state: PersistedPracticeSettings,
  overrides: Partial<PersistedPracticeSettings> = {},
): PersistedPracticeSettings {
  const next = { ...state, ...overrides };
  return {
    activeForms: next.activeForms,
    activeLevels: next.activeLevels,
    includeExpressions: next.includeExpressions,
    promptLanguage: next.promptLanguage,
  };
}

function parseStoredSubset<T>(value: unknown, valid: T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => valid.includes(item as T));
}

function isPromptLanguage(value: unknown): value is PromptLanguage {
  return (PROMPT_LANGUAGES as readonly string[]).includes(value as string);
}

// A malformed *stored* value falls back to the default; a malformed *setter*
// argument is ignored instead, so it can never reset a choice the user made.
function parseStoredPromptLanguage(value: unknown): PromptLanguage {
  return isPromptLanguage(value) ? value : 'both';
}

function safeForms(forms: KeigoForm[]): KeigoForm[] {
  const valid = parseStoredSubset(forms, allForms);
  return valid.length > 0 ? valid : ['sonkeigo'];
}

function safeLevels(levels: BusinessLevel[]): BusinessLevel[] {
  const valid = parseStoredSubset(levels, allLevels);
  return valid.length > 0 ? valid : ['basic'];
}

async function persist(state: PersistedPracticeSettings): Promise<boolean> {
  return safeSetItem('practiceSettings', JSON.stringify(state));
}

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => ({
  ...defaultSettings(),
  loaded: false,
  loadError: false,

  loadPracticeSettings: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      let stored: string | null;
      try {
        stored = await AsyncStorage.getItem('practiceSettings');
      } catch (e) {
        console.warn('Failed to load practice settings:', e);
        set({ loadError: true });
        return;
      }

      if (!stored) {
        set({ ...defaultSettings(), loaded: true, loadError: false });
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        const forms = parseStoredSubset(parsed?.activeForms, allForms);
        const levels = parseStoredSubset(parsed?.activeLevels, allLevels);
        const next = snapshot(defaultSettings(), {
          activeForms: forms.length > 0 ? forms : [...allForms],
          activeLevels: levels.length > 0 ? levels : [...allLevels],
          includeExpressions:
            typeof parsed?.includeExpressions === 'boolean' ? parsed.includeExpressions : true,
          promptLanguage: parseStoredPromptLanguage(parsed?.promptLanguage),
        });
        const recovered = JSON.stringify(next) === stored || await persist(next);
        set({
          ...next,
          loaded: true,
          loadError: !recovered,
        });
      } catch (e) {
        console.warn('Resetting malformed practice settings:', e);
        const next = defaultSettings();
        const recovered = await persist(next);
        set({ ...next, loaded: true, loadError: !recovered });
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
      const ok = await persist(snapshot(get(), { activeForms: next }));
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
      const ok = await persist(snapshot(get(), { activeLevels: next }));
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
      const ok = await persist(snapshot(get(), { activeForms: updated }));
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
      const ok = await persist(snapshot(get(), { activeLevels: updated }));
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
      const ok = await persist(snapshot(get(), { includeExpressions: next }));
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ includeExpressions: next });
    });
  },

  setPromptLanguage: async (language) => {
    if (!get().loaded) await get().loadPracticeSettings();
    if (!get().loaded) {
      console.warn('Skipping prompt language update: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      if (!isPromptLanguage(language)) {
        console.warn('Ignoring unknown prompt language:', language);
        return;
      }
      if (language === get().promptLanguage) return;
      const ok = await persist(snapshot(get(), { promptLanguage: language }));
      if (!ok) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ promptLanguage: language });
    });
  },
}));

export function __resetPracticeSettingsStoreForTests() {
  queue.reset();
  usePracticeSettingsStore.setState({
    ...defaultSettings(),
    loaded: false,
    loadError: false,
  });
}

export { allForms, allLevels };
