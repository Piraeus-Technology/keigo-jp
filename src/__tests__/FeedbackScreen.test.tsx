import React from 'react';
import { Alert } from 'react-native';
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
