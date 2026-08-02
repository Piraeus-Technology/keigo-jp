import React from 'react';
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FeedbackScreen from '../screens/FeedbackScreen';
import { resetLearningData } from '../utils/resetLearningData';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

jest.mock('../store/themeStore', () => ({
  useThemeStore: Object.assign(
    (selector?: (state: {
      isDark: boolean;
      autoTTS: boolean;
      toggleTheme: () => Promise<void>;
      toggleAutoTTS: () => Promise<void>;
    }) => unknown) => {
      const state = {
        isDark: false,
        autoTTS: false,
        toggleTheme: jest.fn(),
        toggleAutoTTS: jest.fn(),
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({ isDark: false, autoTTS: false }),
    },
  ),
}));

jest.mock('../utils/resetLearningData', () => ({
  resetLearningData: jest.fn(),
}));

describe('FeedbackScreen accessibility', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('exposes each actionable row as a purpose-labelled button', () => {
    render(<FeedbackScreen />);

    const labels = [
      'Quiz Stats',
      'Flashcard Stats',
      'Reset Learning Data',
      'Send Feedback, opens email app',
      'Enjoying KeiGo JP? Rate the app',
      'Share KeiGo JP',
      'Privacy Policy, opens in browser',
    ];

    expect(screen.getAllByRole('button')).toHaveLength(labels.length);
    labels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toHaveProp(
        'accessibilityLabel',
        label,
      );
    });
  });

  test('exposes row subtitles as supplementary accessibility hints', () => {
    render(<FeedbackScreen />);

    const storeName = Platform.OS === 'android' ? 'Google Play' : 'App Store';
    const rowsWithSubtitles = [
      ['Quiz Stats', 'Streak, accuracy, activity calendar'],
      ['Flashcard Stats', 'Cards reviewed, accuracy, weak verbs'],
      ['Reset Learning Data', 'Deletes progress, favorites, and history; keeps settings'],
      ['Send Feedback, opens email app', 'Bug reports, suggestions, missing content'],
      ['Enjoying KeiGo JP? Rate the app', `Rate us on ${storeName}`],
      ['Share KeiGo JP', 'Tell a friend about the app'],
    ];

    rowsWithSubtitles.forEach(([label, hint]) => {
      expect(screen.getByRole('button', { name: label })).toHaveProp(
        'accessibilityHint',
        hint,
      );
    });
  });

  test('tracks the reset button accessibility state while a reset is in flight', async () => {
    let finishReset: (cleared: boolean) => void = () => {};
    jest.mocked(resetLearningData).mockImplementation(
      () => new Promise<boolean>((resolve) => {
        finishReset = resolve;
      }),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<FeedbackScreen />);

    expect(screen.getByLabelText('Reset Learning Data')).toHaveProp(
      'accessibilityState',
      { disabled: false },
    );

    fireEvent.press(screen.getByLabelText('Reset Learning Data'));
    const confirmationButtons = alertSpy.mock.calls[0][2];
    const destructiveButton = confirmationButtons?.find(
      (button) => button.text === 'Reset Learning Data',
    );
    act(() => {
      destructiveButton?.onPress?.();
    });

    expect(screen.getByLabelText('Reset Learning Data')).toHaveProp(
      'accessibilityState',
      { disabled: true },
    );

    await act(async () => {
      finishReset(true);
    });

    expect(screen.getByLabelText('Reset Learning Data')).toHaveProp(
      'accessibilityState',
      { disabled: false },
    );
  });
});

describe('FeedbackScreen learning-data reset', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('requires destructive confirmation and reports a failed clear as incomplete', async () => {
    jest.mocked(resetLearningData).mockResolvedValue(false);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Reset Learning Data'));

    expect(resetLearningData).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Reset Learning Data?',
      expect.stringContaining('This cannot be undone.'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Reset Learning Data', style: 'destructive' }),
      ]),
    );

    const confirmationButtons = alertSpy.mock.calls[0][2];
    const destructiveButton = confirmationButtons?.find(
      (button) => button.text === 'Reset Learning Data',
    );
    await act(async () => {
      destructiveButton?.onPress?.();
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Reset Incomplete',
        expect.stringContaining('could not be deleted'),
      );
    });
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Learning Data Reset',
      expect.any(String),
    );
  });
});
