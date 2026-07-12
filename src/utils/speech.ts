import * as Speech from 'expo-speech';

let speechToken = 0;

// Lightweight pub/sub so a global on-screen indicator can show a visible,
// device-independent response whenever speech is triggered. TTS audio alone is
// invisible and unavailable on many devices (e.g. no ja-JP voice installed),
// which makes a speak control read as "unresponsive".
type StartListener = (text: string) => void;
const startListeners = new Set<StartListener>();
const endListeners = new Set<() => void>();

export function onSpeechStart(listener: StartListener): () => void {
  startListeners.add(listener);
  return () => {
    startListeners.delete(listener);
  };
}

export function onSpeechEnd(listener: () => void): () => void {
  endListeners.add(listener);
  return () => {
    endListeners.delete(listener);
  };
}

function emitStart(text: string) {
  startListeners.forEach((l) => {
    try {
      l(text);
    } catch {
      /* ignore listener errors */
    }
  });
}

function emitEnd() {
  endListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function speak(text: string) {
  const token = ++speechToken;
  // Notify synchronously so UI feedback appears the instant the control is
  // tapped, regardless of whether audio actually plays.
  emitStart(text);
  Promise.resolve(Speech.stop())
    .catch(() => undefined)
    .then(() => {
      if (token !== speechToken) return;
      Speech.speak(text, {
        language: 'ja-JP',
        rate: 0.85,
        onDone: () => {
          if (token === speechToken) emitEnd();
        },
        onStopped: () => {
          if (token === speechToken) emitEnd();
        },
        onError: (error) => {
          console.warn('Speech playback failed:', error);
          if (token === speechToken) emitEnd();
        },
      });
    })
    .catch((error) => {
      console.warn('Speech playback failed:', error);
      emitEnd();
    });
}

export function stopSpeech() {
  speechToken++;
  emitEnd();
  Promise.resolve(Speech.stop()).catch(() => undefined);
}
