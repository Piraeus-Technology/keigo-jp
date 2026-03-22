import * as Speech from 'expo-speech';

export function speak(text: string) {
  Speech.stop();
  Speech.speak(text, {
    language: 'ja-JP',
    rate: 0.85,
  });
}
