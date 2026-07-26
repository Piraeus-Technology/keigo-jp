import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetFavoritesStoreForTests,
  useFavoritesStore,
} from '../store/favoritesStore';
import {
  __resetFlashcardSessionStoreForTests,
  useFlashcardSessionStore,
} from '../store/flashcardSessionStore';
import {
  __resetFlashcardStatsStoreForTests,
  useFlashcardStatsStore,
} from '../store/flashcardStatsStore';
import {
  __resetHistoryStoreForTests,
  useHistoryStore,
} from '../store/historyStore';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import { __resetSessionStoreForTests, useSessionStore } from '../store/sessionStore';
import {
  __resetSpacedRepStoreForTests,
  useSpacedRepStore,
} from '../store/spacedRepStore';
import {
  LEARNING_DATA_KEYS,
  PREFERENCE_KEYS,
  resetLearningData,
} from '../utils/resetLearningData';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

const storedLearningData: Record<(typeof LEARNING_DATA_KEYS)[number], string> = {
  quiz_stats: JSON.stringify({ totalQuestions: 12, totalCorrect: 9, bestStreak: 4 }),
  flashcard_stats: JSON.stringify({ totalReviewed: 10, totalCorrect: 7 }),
  sessions: JSON.stringify([
    { day: '2026-07-26', total: 12, correct: 9, streak: 4 },
  ]),
  flashcardSessions: JSON.stringify([
    { day: '2026-07-26', reviewed: 10, correct: 7 },
  ]),
  spaced_rep_weights: JSON.stringify({ 行く: 3, 恐れ入ります: 2 }),
  favorites: JSON.stringify(['行く']),
  keigo_history: JSON.stringify(['来る']),
};

const storedPreferences: Record<(typeof PREFERENCE_KEYS)[number], string> = {
  practiceSettings: JSON.stringify({
    activeForms: ['sonkeigo'],
    activeLevels: ['advanced'],
    includeExpressions: false,
  }),
  theme_mode: 'dark',
  auto_tts: 'true',
};

async function loadLearningStores() {
  await Promise.all([
    useQuizStore.getState().loadStats(),
    useFlashcardStatsStore.getState().loadStats(),
    useSessionStore.getState().loadSessions(),
    useFlashcardSessionStore.getState().loadSessions(),
    useSpacedRepStore.getState().loadWeights(),
    useFavoritesStore.getState().loadFavorites(),
    useHistoryStore.getState().loadHistory(),
  ]);
}

describe('resetLearningData', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockImplementation(
      (key) => Promise.resolve(mockStorage.get(key) ?? null),
    );
    jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation((key) => {
      mockStorage.delete(key);
      return Promise.resolve();
    });

    __resetQuizStoreForTests();
    __resetFlashcardStatsStoreForTests();
    __resetSessionStoreForTests();
    __resetFlashcardSessionStoreForTests();
    __resetSpacedRepStoreForTests();
    __resetFavoritesStoreForTests();
    __resetHistoryStoreForTests();

    Object.entries({ ...storedLearningData, ...storedPreferences }).forEach(([key, value]) => {
      mockStorage.set(key, value);
    });
    await loadLearningStores();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('removes every learning key, empties every store, and keeps preferences', async () => {
    await expect(resetLearningData()).resolves.toBe(true);

    LEARNING_DATA_KEYS.forEach((key) => {
      expect(mockStorage.has(key)).toBe(false);
    });
    PREFERENCE_KEYS.forEach((key) => {
      expect(mockStorage.get(key)).toBe(storedPreferences[key]);
    });

    expect(useQuizStore.getState()).toMatchObject({
      totalQuestions: 0,
      totalCorrect: 0,
      bestStreak: 0,
      loaded: true,
    });
    expect(useFlashcardStatsStore.getState()).toMatchObject({
      totalReviewed: 0,
      totalCorrect: 0,
      loaded: true,
    });
    expect(useSessionStore.getState()).toMatchObject({ sessions: [], loaded: true });
    expect(useFlashcardSessionStore.getState()).toMatchObject({ sessions: [], loaded: true });
    expect(useSpacedRepStore.getState()).toMatchObject({ weights: {}, loaded: true });
    expect(useFavoritesStore.getState()).toMatchObject({ favorites: [], loaded: true });
    expect(useHistoryStore.getState()).toMatchObject({ history: [], loaded: true });
  });

  test('returns false and preserves a store when its storage removal fails', async () => {
    jest.mocked(AsyncStorage.removeItem).mockImplementation((key) => {
      if (key === 'favorites') return Promise.reject(new Error('disk locked'));
      mockStorage.delete(key);
      return Promise.resolve();
    });

    await expect(resetLearningData()).resolves.toBe(false);

    expect(mockStorage.get('favorites')).toBe(storedLearningData.favorites);
    expect(useFavoritesStore.getState().favorites).toEqual(['行く']);
    expect(mockStorage.has('quiz_stats')).toBe(false);
    expect(useQuizStore.getState().totalQuestions).toBe(0);
  });
});
