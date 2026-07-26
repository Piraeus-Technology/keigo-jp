import React from 'react';
import { Animated } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import FlashcardScreen from '../screens/FlashcardScreen';

const mockRecordReview = jest.fn(() => Promise.resolve());
const mockRecordResult = jest.fn(() => Promise.resolve());
const mockLoadPracticeSettings = jest.fn();
const mockLoadSessions = jest.fn();
const mockSaveSession = jest.fn(() => Promise.resolve(true));
const mockLoadStats = jest.fn();
const mockPracticeSettingsState = {
  activeForms: ['sonkeigo', 'kenjougo'],
  activeLevels: ['basic', 'intermediate', 'advanced'],
  includeExpressions: true,
  loaded: true,
  loadPracticeSettings: mockLoadPracticeSettings,
};
const mockFlashcardSessionState = {
  sessions: [],
  loadSessions: mockLoadSessions,
  saveSession: mockSaveSession,
};
const mockFlashcardStatsState = {
  loadStats: mockLoadStats,
  recordReview: mockRecordReview,
};
const mockSpacedRepState = {
  recordResult: mockRecordResult,
};

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('../utils/speech', () => ({
  speak: jest.fn(),
  stopSpeech: jest.fn(),
}));

jest.mock('../hooks/useSessionAutosave', () => ({
  useSessionAutosave: () => ({ unsavedCount: 0, unsavedCorrect: 0 }),
}));

jest.mock('../store/practiceSettingsStore', () => ({
  usePracticeSettingsStore: () => mockPracticeSettingsState,
}));

jest.mock('../store/flashcardSessionStore', () => ({
  useFlashcardSessionStore: () => mockFlashcardSessionState,
}));

jest.mock('../store/flashcardStatsStore', () => ({
  useFlashcardStatsStore: () => mockFlashcardStatsState,
}));

jest.mock('../store/spacedRepStore', () => ({
  useSpacedRepStore: () => mockSpacedRepState,
}));

jest.mock('../store/themeStore', () => ({
  useThemeStore: Object.assign(
    (selector?: (state: { autoTTS: boolean; isDark: boolean }) => unknown) => {
      const state = { autoTTS: false, isDark: false };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ autoTTS: false, isDark: false }),
    },
  ),
}));

describe('FlashcardScreen flip and grade guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Animated, 'timing').mockImplementation(((value, config) => ({
      start: (callback?: (result: { finished: boolean }) => void) => {
        (value as Animated.Value).setValue(config.toValue as number);
        if (config.toValue === 1) callback?.({ finished: true });
      },
      stop: jest.fn(),
      reset: jest.fn(),
    })) as typeof Animated.timing);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('hides the answer until reveal and records only one grade', () => {
    render(<FlashcardScreen />);

    const prompt = screen.getByLabelText(/Flashcard prompt:/);
    const animatedViews = screen.UNSAFE_getAllByType(Animated.View);
    expect(animatedViews.some((view) =>
      view.props.importantForAccessibility === 'no-hide-descendants'
    )).toBe(true);

    act(() => {
      fireEvent.press(prompt);
    });

    const gotIt = screen.getByLabelText('Mark card as got it');
    expect(gotIt.props.accessibilityState.disabled).toBe(false);
    act(() => {
      fireEvent.press(gotIt);
      fireEvent.press(gotIt);
    });

    expect(mockRecordReview).toHaveBeenCalledTimes(1);
    expect(mockRecordResult).toHaveBeenCalledTimes(1);
  });
});
