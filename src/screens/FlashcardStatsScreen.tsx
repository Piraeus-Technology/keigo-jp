import React from 'react';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useFlashcardStatsStore } from '../store/flashcardStatsStore';
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
    totalReviewed,
    totalCorrect,
    loadStats,
  } = useFlashcardStatsStore();
  const {
    weights,
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
  } = useSpacedRepStore();

  React.useEffect(() => {
    loadSessions();
    loadStats();
    loadWeights();
  }, [loadSessions, loadStats, loadWeights]);

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
      allTimeOverride={{
        count: totalReviewed,
        correct: totalCorrect,
        thirdStat: { value: sessions.length, label: 'Days' },
      }}
      onRetry={() => {
        loadSessions();
        loadStats();
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
