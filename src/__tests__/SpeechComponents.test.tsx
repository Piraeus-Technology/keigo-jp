import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SpeakButton from '../components/SpeakButton';
import SpeechIndicator from '../components/SpeechIndicator';

const mockSpeak = jest.fn();
const mockIsSpeechPlaying = jest.fn(() => Promise.resolve(false));
let mockStartListener: ((text: string) => void) | null = null;
let mockPlaybackStartListener: (() => void) | null = null;
let mockEndListener: (() => void) | null = null;

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  isSpeechPlaying: () => mockIsSpeechPlaying(),
  onSpeechStart: (listener: (text: string) => void) => {
    mockStartListener = listener;
    return () => {
      mockStartListener = null;
    };
  },
  onSpeechPlaybackStart: (listener: () => void) => {
    mockPlaybackStartListener = listener;
    return () => {
      mockPlaybackStartListener = null;
    };
  },
  onSpeechEnd: (listener: () => void) => {
    mockEndListener = listener;
    return () => {
      mockEndListener = null;
    };
  },
}));

describe('speech components', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('SpeakButton exposes a meaningful control and triggers speech', () => {
    render(<SpeakButton text="参ります" color="#000000" />);

    const button = screen.getByLabelText('Play pronunciation of 参ります');
    expect(button.props.accessibilityRole).toBe('button');
    fireEvent.press(button);
    expect(mockSpeak).toHaveBeenCalledWith('参ります');
  });

  test('SpeechIndicator stays accessibility-hidden and polls during long speech', async () => {
    jest.useFakeTimers();
    mockIsSpeechPlaying
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    render(<SpeechIndicator />);

    act(() => {
      mockStartListener?.('お待ちしております');
      mockPlaybackStartListener?.();
    });

    screen.getByText('お待ちしております', { includeHiddenElements: true });
    const indicator = screen.UNSAFE_getAllByType(View).find(
      (view) => view.props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(indicator?.props.accessibilityElementsHidden).toBe(true);
    expect(indicator?.props.importantForAccessibility).toBe('no-hide-descendants');

    await act(async () => {
      jest.advanceTimersByTime(2500);
      await Promise.resolve();
    });
    expect(mockIsSpeechPlaying).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(mockIsSpeechPlaying).toHaveBeenCalledTimes(2);

    act(() => {
      mockEndListener?.();
    });
  });
});
