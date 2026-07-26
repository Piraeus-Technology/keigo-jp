import React from 'react';
import { render, screen } from '@testing-library/react-native';
import verbs from '../data/verbs.json';
import QuizScreen, { generateQuestion } from '../screens/QuizScreen';
import { isGradableVerbForm } from '../utils/gradableVerbs';
import type { KeigoForm, VerbData } from '../utils/keigoTypes';

const mockLoadStats = jest.fn();
const mockLoadWeights = jest.fn();
const mockLoadSettings = jest.fn();
const mockLoadSessions = jest.fn();

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

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  requestReview: jest.fn(),
}));

jest.mock('../utils/speech', () => ({
  stopSpeech: jest.fn(),
}));

jest.mock('../hooks/useSessionAutosave', () => ({
  useSessionAutosave: () => ({ unsavedCount: 0, unsavedCorrect: 0 }),
}));

jest.mock('../store/quizStore', () => ({
  useQuizStore: () => ({
    totalQuestions: 0,
    totalCorrect: 0,
    bestStreak: 0,
    loadStats: mockLoadStats,
    recordAnswer: jest.fn(),
  }),
}));

jest.mock('../store/spacedRepStore', () => ({
  useSpacedRepStore: () => ({
    loaded: false,
    loadError: false,
    loadWeights: mockLoadWeights,
    recordResult: jest.fn(),
    getWeight: () => 1,
  }),
}));

jest.mock('../store/practiceSettingsStore', () => ({
  usePracticeSettingsStore: () => ({
    activeForms: ['sonkeigo', 'kenjougo'],
    activeLevels: ['basic', 'intermediate', 'advanced'],
    loaded: false,
    loadError: false,
    loadPracticeSettings: mockLoadSettings,
  }),
}));

jest.mock('../store/sessionStore', () => ({
  useSessionStore: () => ({
    sessions: [],
    loadSessions: mockLoadSessions,
    saveSession: jest.fn(() => Promise.resolve(true)),
  }),
}));

describe('QuizScreen loading state', () => {
  test('does not render the empty-pool message before stores load', () => {
    render(<QuizScreen />);

    expect(screen.getByText('Loading practice…')).toBeTruthy();
    expect(screen.queryByText('No matching verbs')).toBeNull();
  });
});

describe('QuizScreen question eligibility', () => {
  const verbEntries = Object.entries(verbs as Record<string, VerbData>);
  const forms: KeigoForm[] = ['sonkeigo', 'kenjougo', 'teineigo'];

  test('never generates a question whose answer is its prompt', () => {
    for (const entry of verbEntries) {
      for (const form of forms) {
        const question = generateQuestion([form], () => 1, [entry], () => 0);
        if (!isGradableVerbForm(entry[0], entry[1], form)) {
          expect(question).toBeNull();
        } else {
          expect(question?.correctAnswer).not.toBe(question?.verb);
        }
      }
    }
  });

  test('keeps a non-degenerate form available on a partially excluded record', () => {
    const entry = verbEntries.find(([verb]) => verb === '申す')!;

    expect(generateQuestion(['kenjougo'], () => 1, [entry], () => 0)).toBeNull();
    expect(generateQuestion(
      ['sonkeigo'],
      () => 1,
      [entry],
      () => 0,
    )?.correctAnswer).toBe('おっしゃる');
  });
});
