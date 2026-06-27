import * as Speech from 'expo-speech';

export function speak(text: string) {
  Promise.resolve(Speech.stop())
    .catch(() => undefined)
    .then(() => {
      Speech.speak(text, {
        language: 'ja-JP',
        rate: 0.85,
        onError: (error) => console.warn('Speech playback failed:', error),
      });
    })
    .catch((error) => console.warn('Speech playback failed:', error));
}

export function stopSpeech() {
  Promise.resolve(Speech.stop()).catch(() => undefined);
}
