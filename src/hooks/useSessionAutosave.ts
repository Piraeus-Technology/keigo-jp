import React from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getTodayKey } from '../utils/dayKey';

interface SessionDelta {
  count: number;
  correct: number;
  bestStreak: number;
  day: string;
}

// Auto-saves new answers when the screen blurs, the app backgrounds, or the
// component unmounts. Save attempts are serialized so re-entrant triggers
// cannot interleave their last-saved bookkeeping. Markers advance only after a
// successful save; failed deltas remain unsaved and get retried next time.
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
  const attributionDayRef = React.useRef<string | null>(null);
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  countRef.current = count;
  correctRef.current = correct;
  bestStreakRef.current = bestStreak;
  saveRef.current = save;

  // Attribute an unsaved batch to the day of its first answer, not the
  // (possibly post-midnight) flush time. Cleared once everything is saved so
  // the next batch re-stamps with its own first-answer day.
  if (count > lastSavedCountRef.current) {
    if (attributionDayRef.current === null) {
      attributionDayRef.current = getTodayKey();
    }
  } else {
    attributionDayRef.current = null;
  }

  const saveNow = React.useCallback(() => {
    const run = async () => {
      const snapshotCount = countRef.current;
      const snapshotCorrect = correctRef.current;
      const unsavedCount = snapshotCount - lastSavedCountRef.current;
      const unsavedCorrect = snapshotCorrect - lastSavedCorrectRef.current;
      const unsavedBestStreak = Math.max(bestStreakRef.current, lastSavedBestStreakRef.current);
      const day = attributionDayRef.current ?? getTodayKey();

      if (unsavedCount <= 0) return;

      try {
        await saveRef.current({
          count: unsavedCount,
          correct: unsavedCorrect,
          bestStreak: unsavedBestStreak,
          day,
        });
        lastSavedCountRef.current = snapshotCount;
        lastSavedCorrectRef.current = snapshotCorrect;
        lastSavedBestStreakRef.current = unsavedBestStreak;
        // Answers that arrived during this save form the next batch; let it
        // pick up its own first-answer day.
        if (countRef.current === snapshotCount) {
          attributionDayRef.current = null;
        }
      } catch (e) {
        console.warn('Failed to save session:', e);
      }
    };

    const next = saveQueueRef.current.then(run, run);
    saveQueueRef.current = next.catch(() => undefined);
    return next;
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
