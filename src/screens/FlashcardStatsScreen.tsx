import React from 'react';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import PracticeStatsView, { DayCounts } from '../components/PracticeStatsView';

export default function FlashcardStatsScreen() {
  const {
    sessions,
    loaded: sessionsLoaded,
    loadError: sessionsLoadError,
    loadSessions,
  } = useFlashcardSessionStore();
  const {
    weights,
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
  } = useSpacedRepStore();

  React.useEffect(() => {
    loadSessions();
    loadWeights();
  }, [loadSessions, loadWeights]);

  const dayCounts: DayCounts[] = React.useMemo(
    () => sessions.map(s => ({ day: s.day, count: s.reviewed, correct: s.correct })),
    [sessions],
  );

  return (
    <PracticeStatsView
      sessions={dayCounts}
      sessionsLoaded={sessionsLoaded}
      sessionsLoadError={sessionsLoadError}
      weights={weights}
      weightsLoaded={weightsLoaded}
      weightsLoadError={weightsLoadError}
      onRetry={() => {
        loadSessions();
        loadWeights();
      }}
      labels={{
        countLabel: 'Cards',
        daysLabel: 'Sessions',
        loadingText: 'Loading flashcard stats...',
        errorText: 'Could not load flashcard stats.',
        retryAccessibilityLabel: 'Retry loading flashcard stats',
        emptyIcon: 'layers-outline',
        emptySubtitle: 'Start a flashcard session to track your progress',
      }}
    />
  );
}
