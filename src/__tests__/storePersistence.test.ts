import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  __resetPracticeSettingsStoreForTests,
  allForms,
  allLevels,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import { __resetSpacedRepStoreForTests, useSpacedRepStore } from '../store/spacedRepStore';
import { __resetThemeStoreForTests, useThemeStore } from '../store/themeStore';

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

describe('store persistence hardening', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    __resetPracticeSettingsStoreForTests();
    __resetQuizStoreForTests();
    __resetSpacedRepStoreForTests();
    __resetThemeStoreForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('quiz answer after failed load refuses to clobber stats', async () => {
    mockStorage.set('quiz_stats', JSON.stringify({ totalQuestions: 20, totalCorrect: 15, bestStreak: 6 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk locked'));

    await useQuizStore.getState().recordAnswer(true, 1);

    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 20,
      totalCorrect: 15,
      bestStreak: 6,
    });
    expect(useQuizStore.getState()).toMatchObject({ loaded: false, loadError: true });
  });

  test('spaced repetition result stays bare-key and recovers after transient load failure', async () => {
    mockStorage.set('spaced_rep_weights', JSON.stringify({ 書く: 4 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('transient'));

    await useSpacedRepStore.getState().recordResult('書く', false);
    expect(useSpacedRepStore.getState()).toMatchObject({ loaded: false, loadError: true });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ 書く: 4 });

    await useSpacedRepStore.getState().recordResult('書く', false);

    // Incorrect bumps weight *1.5, capped at MAX_WEIGHT (5): 4 -> min(5, 6) = 5.
    expect(useSpacedRepStore.getState()).toMatchObject({
      loaded: true,
      loadError: false,
      weights: { 書く: 5 },
    });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ 書く: 5 });
  });

  test('practice settings drops unknown persisted values and refills empty subsets', async () => {
    mockStorage.set(
      'practiceSettings',
      JSON.stringify({ activeForms: ['sonkeigo', 'bogus_form'], activeLevels: [] }),
    );

    await usePracticeSettingsStore.getState().loadPracticeSettings();

    expect(usePracticeSettingsStore.getState().activeForms).toEqual(['sonkeigo']);
    expect(usePracticeSettingsStore.getState().activeLevels).toEqual(allLevels);
  });

  test('practice settings keeps includeExpressions and write failure leaves state unchanged', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState().includeExpressions).toBe(true);

    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    await usePracticeSettingsStore.getState().setActiveForms(['sonkeigo']);

    expect(usePracticeSettingsStore.getState().activeForms).toEqual(allForms);
    expect(mockStorage.get('practiceSettings')).toBeUndefined();
  });

  test('practice settings persists only user-facing settings', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();

    await usePracticeSettingsStore.getState().setActiveForms(['sonkeigo']);

    expect(JSON.parse(mockStorage.get('practiceSettings')!)).toEqual({
      activeForms: ['sonkeigo'],
      activeLevels: allLevels,
      includeExpressions: true,
    });
  });

  test('theme load failure falls back to defaults and still marks loaded', async () => {
    mockStorage.set('theme_mode', 'dark');
    mockStorage.set('auto_tts', 'true');
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('disk locked'));

    await useThemeStore.getState().loadTheme();

    expect(useThemeStore.getState()).toMatchObject({
      isDark: false,
      autoTTS: false,
      loaded: true,
      loadError: true,
    });
    expect(mockStorage.get('theme_mode')).toBe('dark');
    expect(mockStorage.get('auto_tts')).toBe('true');
  });
});
