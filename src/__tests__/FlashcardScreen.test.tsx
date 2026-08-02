import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import FlashcardScreen, {
  FlashcardAnswerText,
  englishPromptFor,
  filterEntriesByLevels,
  generateCard,
  getPromptFace,
  selectWeightedEntry,
} from '../screens/FlashcardScreen';
import type { Card } from '../screens/FlashcardScreen';
import { isGradableVerbForm } from '../utils/gradableVerbs';
import type { ExpressionData, PromptLanguage, VerbData } from '../utils/keigoTypes';

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
  promptLanguage: 'both' as PromptLanguage,
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

describe('FlashcardScreen prompt language', () => {
  const verbCard: Card = {
    srKey: '食べる',
    front: '食べる',
    reading: 'たべる',
    translation: 'to eat',
    form: 'sonkeigo',
    answer: '召し上がる',
    answerReading: 'めしあがる',
    cardType: 'verb',
  };
  const expressionCard: Card = {
    srKey: 'お世話になっております',
    front: 'Thank you for your continued support',
    reading: '',
    translation: 'Thank you for your continued support',
    answer: 'お世話になっております',
    answerReading: 'おせわになっております',
    cardType: 'expression',
  };

  test('shows both sides of a verb card by default', () => {
    expect(getPromptFace(verbCard, 'both')).toEqual({
      label: '尊敬語 — Respectful',
      primary: '食べる',
      primaryVariant: 'headword',
      reading: 'たべる',
      translation: 'to eat',
    });
  });

  test('drops only the English meaning in Japanese mode', () => {
    expect(getPromptFace(verbCard, 'japanese')).toEqual({
      label: '尊敬語 — Respectful',
      primary: '食べる',
      primaryVariant: 'headword',
      reading: 'たべる',
      translation: null,
    });
  });

  test('asks for the keigo of the English meaning in English mode', () => {
    expect(getPromptFace(verbCard, 'english')).toEqual({
      label: '尊敬語 — Respectful',
      primary: 'How do you say “to eat” in keigo?',
      primaryVariant: 'sentence',
      reading: null,
      translation: null,
    });
  });

  test('falls back to the Japanese headword when a verb has no translation', () => {
    const face = getPromptFace({ ...verbCard, translation: '' }, 'english');

    expect(face.primary).toBe('食べる');
    expect(face.primaryVariant).toBe('headword');
  });

  test('keeps expression cards English-prompted in every mode', () => {
    const expected = {
      label: 'How do you say this in keigo?',
      primary: 'Thank you for your continued support',
      primaryVariant: 'sentence',
      reading: null,
      translation: null,
    };
    const languages: PromptLanguage[] = ['japanese', 'english', 'both'];

    for (const language of languages) {
      expect(getPromptFace(expressionCard, language)).toEqual(expected);
    }
  });

  test('builds the English prompt from the meaning alone', () => {
    expect(englishPromptFor('to receive')).toBe('How do you say “to receive” in keigo?');
  });
});

describe('FlashcardScreen prompt language wiring', () => {
  const expressionQuestion = 'How do you say this in keigo?';

  const promptTextOf = (view: ReturnType<typeof render>) => {
    const label = view.getByLabelText(/Flashcard prompt:/).props.accessibilityLabel as string;
    return /^Flashcard prompt: (.*)\. Tap to reveal the answer\.$/.exec(label)![1];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPracticeSettingsState.promptLanguage = 'both';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockPracticeSettingsState.promptLanguage = 'both';
  });

  test('keeps expression cards out of the pool when prompts are Japanese', () => {
    // generateCard spends its first draw on the 30% expression branch, so 0.1
    // forces an expression card whenever expressions are still enabled.
    jest.spyOn(Math, 'random').mockReturnValue(0.1);

    const mixed = render(<FlashcardScreen />);
    expect(mixed.getByText(expressionQuestion)).toBeTruthy();
    mixed.unmount();

    mockPracticeSettingsState.promptLanguage = 'japanese';
    const japaneseOnly = render(<FlashcardScreen />);

    expect(japaneseOnly.queryByText(expressionQuestion)).toBeNull();
    expect(verbs as Record<string, VerbData>).toHaveProperty(promptTextOf(japaneseOnly));
  });

  test('hides the English meaning on a Japanese-prompted verb card', () => {
    // A fixed draw picks the same verb in both renders, so the mixed render is
    // an exact control for the absent translation rather than a bare absence.
    jest.spyOn(Math, 'random').mockReturnValue(0.9);

    const mixed = render(<FlashcardScreen />);
    const headword = promptTextOf(mixed);
    const data = (verbs as Record<string, VerbData>)[headword];
    expect(data).toBeDefined();
    expect(mixed.getByText(data.translation)).toBeTruthy();
    mixed.unmount();

    mockPracticeSettingsState.promptLanguage = 'japanese';
    const japaneseOnly = render(<FlashcardScreen />);

    expect(promptTextOf(japaneseOnly)).toBe(headword);
    expect(japaneseOnly.getByText(data.reading)).toBeTruthy();
    expect(japaneseOnly.queryByText(data.translation)).toBeNull();
  });

  test('prompts a verb card by its English meaning in English mode', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    mockPracticeSettingsState.promptLanguage = 'english';

    const view = render(<FlashcardScreen />);
    const prompt = promptTextOf(view);
    const headword = /^How do you say “(.+)” in keigo\?$/.exec(prompt)?.[1];

    expect(headword).toBeDefined();
    expect(
      Object.values(verbs as Record<string, VerbData>).some(
        (data) => data.translation === headword,
      ),
    ).toBe(true);
    expect(view.getByText(prompt)).toBeTruthy();
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
