import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import FlashcardScreen, {
  FlashcardAnswerText,
  filterEntriesByLevels,
  generateCard,
  selectWeightedEntry,
} from '../screens/FlashcardScreen';
import { isGradableVerbForm } from '../utils/gradableVerbs';
import type { ExpressionData, VerbData } from '../utils/keigoTypes';

const mockRecordReview = jest.fn(() => Promise.resolve());
const mockRecordResult = jest.fn(() => Promise.resolve());
const mockLoadWeights = jest.fn();
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
  loaded: false,
  loadWeights: mockLoadWeights,
  recordResult: mockRecordResult,
  getWeight: () => 1,
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

    expect(mockLoadWeights).toHaveBeenCalledTimes(1);
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

describe('FlashcardScreen weighted card selection', () => {
  const verbEntries = Object.entries(verbs as Record<string, VerbData>);
  const expressionEntries = Object.entries(expressions as Record<string, ExpressionData>);

  test('selects a high-weight card more often across deterministic draws', () => {
    const entries: [string, null][] = [['high', null], ['low', null]];
    const counts = { high: 0, low: 0 };

    for (let i = 0; i < 1000; i++) {
      const selected = selectWeightedEntry(
        entries,
        (key) => key === 'high' ? 5 : 0.2,
        [],
        () => (i + 0.5) / 1000,
      );
      counts[selected![0] as keyof typeof counts] += 1;
    }

    expect(counts.high).toBeGreaterThan(counts.low);
    expect(counts.high).toBe(833);
    expect(counts.low).toBe(167);
  });

  test('keeps every eligible card reachable and discourages immediate repeats', () => {
    const entries: [string, null][] = [
      ['strong', null],
      ['new', null],
      ['weak', null],
    ];
    const weights: Record<string, number> = { strong: 0.2, new: 1, weak: 5 };
    const reached = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const selected = selectWeightedEntry(
        entries,
        (key) => weights[key],
        [],
        () => (i + 0.5) / 1000,
      );
      reached.add(selected![0]);
    }

    expect(reached).toEqual(new Set(['strong', 'new', 'weak']));
    expect(selectWeightedEntry(entries, () => 1, [], () => 0.2)?.[0]).toBe('strong');
    expect(selectWeightedEntry(entries, () => 1, ['strong'], () => 0.2)?.[0]).toBe('new');
  });

  test('keeps the level and expression settings as hard pool gates', () => {
    const basicVerbs = filterEntriesByLevels(verbEntries, ['basic']);
    const verbWeightKeys: string[] = [];
    expect(basicVerbs.length).toBeGreaterThan(0);
    expect(basicVerbs.length).toBeLessThan(verbEntries.length);
    expect(basicVerbs.every(([, data]) => data.level === 'basic')).toBe(true);

    const verbOnly = generateCard(
      basicVerbs,
      expressionEntries,
      false,
      ['sonkeigo'],
      (key) => {
        verbWeightKeys.push(key);
        return 1;
      },
      [],
      () => 0,
    );
    expect(verbOnly?.cardType).toBe('verb');
    expect(basicVerbs.some(([key]) => key === verbOnly?.srKey)).toBe(true);
    expect(verbWeightKeys).toEqual(basicVerbs.map(([key]) => key));

    const expressionWeightKeys: string[] = [];
    const expression = generateCard(
      basicVerbs,
      expressionEntries,
      true,
      ['sonkeigo'],
      (key) => {
        expressionWeightKeys.push(key);
        return 1;
      },
      [],
      () => 0,
    );
    expect(expression?.cardType).toBe('expression');
    expect(expressionEntries.some(([key]) => key === expression?.srKey)).toBe(true);
    expect(expression?.answer).toBe(expression?.srKey);
    expect(expressionWeightKeys).toEqual(expressionEntries.map(([key]) => key));
  });

  test('preserves the thirty-percent expression mix', () => {
    let expressionCards = 0;

    for (let i = 0; i < 100; i++) {
      let randomCall = 0;
      const card = generateCard(
        verbEntries,
        expressionEntries,
        true,
        ['sonkeigo'],
        () => 1,
        [],
        () => {
          randomCall += 1;
          return randomCall === 1 ? (i + 0.5) / 100 : 0.5;
        },
      );
      if (card?.cardType === 'expression') expressionCards += 1;
    }

    expect(expressionCards).toBe(30);
  });

  test('never generates a verb card whose answer is its prompt', () => {
    const forms: ('sonkeigo' | 'kenjougo' | 'teineigo')[] = [
      'sonkeigo',
      'kenjougo',
      'teineigo',
    ];

    for (const entry of verbEntries) {
      for (const form of forms) {
        const card = generateCard(
          [entry],
          [],
          false,
          [form],
          () => 1,
          [],
          () => 0,
        );
        if (!isGradableVerbForm(entry[0], entry[1], form)) {
          expect(card).toBeNull();
        } else {
          expect(card?.answer).not.toBe(card?.front);
        }
      }
    }
  });
});

describe('FlashcardScreen expression answer layout', () => {
  const longestExpression =
    '失礼ですが、もう一度お名前をお伺いしてもよろしいでしょうか';
  const baseCard = {
    srKey: longestExpression,
    front: 'Excuse me, but may I ask your name again?',
    reading: '',
    translation: 'Excuse me, but may I ask your name again?',
    answer: longestExpression,
    answerReading: 'しつれいですが、もういちどおなまえをおうかがいしてもよろしいでしょうか',
    cardType: 'expression' as const,
  };

  test('lets the longest expression wrap at a readable fixed size', () => {
    const view = render(<FlashcardAnswerText card={baseCard} color="#000" />);
    const answer = view.getByText(longestExpression);
    const flattenedStyle = StyleSheet.flatten(answer.props.style);

    expect(answer.props.numberOfLines).toBeUndefined();
    expect(answer.props.adjustsFontSizeToFit).toBe(false);
    expect(flattenedStyle.fontSize).toBe(24);
    expect(flattenedStyle.lineHeight).toBe(32);
  });

  test('keeps the existing two-line auto-fit treatment for short expressions', () => {
    const shortCard = {
      ...baseCard,
      srKey: '恐れ入ります',
      answer: '恐れ入ります',
      answerReading: 'おそれいります',
    };
    const view = render(<FlashcardAnswerText card={shortCard} color="#000" />);
    const answer = view.getByText(shortCard.answer);
    const flattenedStyle = StyleSheet.flatten(answer.props.style);

    expect(answer.props.numberOfLines).toBe(2);
    expect(answer.props.adjustsFontSizeToFit).toBe(true);
    expect(flattenedStyle.fontSize).toBe(40);
  });
});
