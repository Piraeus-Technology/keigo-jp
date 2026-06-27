import React from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface SessionDelta {
  count: number;
  correct: number;
  bestStreak: number;
}

// Auto-saves new answers when the screen blurs, the app backgrounds, or the
// component unmounts. The delta is claimed synchronously before the async
// save so re-entrant triggers (AppState background + nav blur firing
// back-to-back) see zero unsaved and bail instead of double-counting; a
// failed save rolls the claim back so the delta is retried next time.
export function useSessionAutosave({
  count,
  correct,
  bestStreak = 0,
  save,
}: {
  count: number;
  correct: number;
  bestStreak?: number;
  save: (delta: SessionDelta) => Promise<void>;
}): { unsavedCount: number; unsavedCorrect: number } {
  const nav = useNavigation();
  const countRef = React.useRef(count);
  const correctRef = React.useRef(correct);
  const bestStreakRef = React.useRef(bestStreak);
  const saveRef = React.useRef(save);
  const lastSavedCountRef = React.useRef(0);
  const lastSavedCorrectRef = React.useRef(0);
  const lastSavedBestStreakRef = React.useRef(0);
  countRef.current = count;
  correctRef.current = correct;
  bestStreakRef.current = bestStreak;
  saveRef.current = save;

  const saveNow = React.useCallback(async () => {
    const snapshotCount = countRef.current;
    const snapshotCorrect = correctRef.current;
    const unsavedCount = snapshotCount - lastSavedCountRef.current;
    const unsavedCorrect = snapshotCorrect - lastSavedCorrectRef.current;
    const unsavedBestStreak = Math.max(bestStreakRef.current, lastSavedBestStreakRef.current);

    if (unsavedCount <= 0) return;

    const prevSavedCount = lastSavedCountRef.current;
    const prevSavedCorrect = lastSavedCorrectRef.current;
    const prevSavedBestStreak = lastSavedBestStreakRef.current;
    lastSavedCountRef.current = snapshotCount;
    lastSavedCorrectRef.current = snapshotCorrect;
    lastSavedBestStreakRef.current = unsavedBestStreak;

    try {
      await saveRef.current({
        count: unsavedCount,
        correct: unsavedCorrect,
        bestStreak: unsavedBestStreak,
      });
    } catch (e) {
      // Roll back so the lost delta gets retried on the next save.
      lastSavedCountRef.current = prevSavedCount;
      lastSavedCorrectRef.current = prevSavedCorrect;
      lastSavedBestStreakRef.current = prevSavedBestStreak;
      console.warn('Failed to save session:', e);
    }
  }, []);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        saveNow().catch((e) => console.warn('AppState save failed:', e));
      }
    });
    return () => {
      sub.remove();
      saveNow().catch((e) => console.warn('Unmount save failed:', e));
    };
  }, [saveNow]);

  React.useEffect(() => {
    const unsubscribe = nav.addListener('blur', () => {
      saveNow().catch((e) => console.warn('Blur save failed:', e));
    });
    return unsubscribe;
  }, [nav, saveNow]);

  return {
    unsavedCount: count - lastSavedCountRef.current,
    unsavedCorrect: correct - lastSavedCorrectRef.current,
  };
}
