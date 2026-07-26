import * as Speech from 'expo-speech';
import {
  onSpeechEnd,
  onSpeechPlaybackStart,
  onSpeechStart,
  speak,
  stopSpeech,
} from '../utils/speech';

jest.mock('expo-speech', () => ({
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
}));

async function flushSpeechStart() {
  await Promise.resolve();
  await Promise.resolve();
}

function latestSpeechOptions() {
  const calls = jest.mocked(Speech.speak).mock.calls;
  return calls[calls.length - 1][1]!;
}

describe('speech lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Speech.stop).mockResolvedValue();
  });

  test('emits request, playback start, and end events', async () => {
    const starts: string[] = [];
    const playbackStarts: number[] = [];
    const ends: number[] = [];
    const unsubStart = onSpeechStart((text) => starts.push(text));
    const unsubPlayback = onSpeechPlaybackStart(() => playbackStarts.push(1));
    const unsubEnd = onSpeechEnd(() => ends.push(1));

    speak('いらっしゃいます');
    expect(starts).toEqual(['いらっしゃいます']);
    await flushSpeechStart();

    const options = latestSpeechOptions();
    options.onStart?.();
    options.onDone?.();

    expect(playbackStarts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    unsubStart();
    unsubPlayback();
    unsubEnd();
  });

  test('suppresses stale completion callbacks after a newer request', async () => {
    const ends: number[] = [];
    const unsubEnd = onSpeechEnd(() => ends.push(1));

    speak('first');
    await flushSpeechStart();
    const firstOptions = latestSpeechOptions();

    speak('second');
    await flushSpeechStart();
    const secondOptions = latestSpeechOptions();

    firstOptions.onDone?.();
    expect(ends).toEqual([]);
    secondOptions.onDone?.();
    expect(ends).toHaveLength(1);
    unsubEnd();
  });

  test('stopSpeech cancels the current token and emits end immediately', async () => {
    const ends: number[] = [];
    const unsubEnd = onSpeechEnd(() => ends.push(1));

    speak('止める');
    await flushSpeechStart();
    const options = latestSpeechOptions();
    stopSpeech();
    options.onDone?.();

    expect(ends).toHaveLength(1);
    expect(Speech.stop).toHaveBeenCalled();
    unsubEnd();
  });
});
