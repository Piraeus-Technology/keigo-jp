import * as Speech from 'expo-speech';

let speechToken = 0;

export function speak(text: string) {
  const token = ++speechToken;
  Promise.resolve(Speech.stop())
    .catch(() => undefined)
    .then(() => {
      if (token !== speechToken) return;
      Speech.speak(text, {
        language: 'ja-JP',
        rate: 0.85,
        onError: (error) => console.warn('Speech playback failed:', error),
      });
    })
    .catch((error) => console.warn('Speech playback failed:', error));
}

export function stopSpeech() {
  speechToken++;
  Promise.resolve(Speech.stop()).catch(() => undefined);
}
