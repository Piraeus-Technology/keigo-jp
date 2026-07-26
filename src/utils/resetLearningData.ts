import { useFavoritesStore } from '../store/favoritesStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useFlashcardStatsStore } from '../store/flashcardStatsStore';
import { useHistoryStore } from '../store/historyStore';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';

export const LEARNING_DATA_KEYS = [
  'quiz_stats',
  'flashcard_stats',
  'sessions',
  'flashcardSessions',
  'spaced_rep_weights',
  'favorites',
  'keigo_history',
] as const;

export const PREFERENCE_KEYS = [
  'practiceSettings',
  'theme_mode',
  'auto_tts',
] as const;

export async function resetLearningData(): Promise<boolean> {
  const results = await Promise.all([
    useQuizStore.getState().resetStats(),
    useFlashcardStatsStore.getState().resetStats(),
    useSessionStore.getState().clearSessions(),
    useFlashcardSessionStore.getState().clearSessions(),
    useSpacedRepStore.getState().resetWeights(),
    useFavoritesStore.getState().clearFavorites(),
    useHistoryStore.getState().clearHistory(),
  ]);

  return results.every(Boolean);
}
