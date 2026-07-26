import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PracticeStatsView from '../components/PracticeStatsView';

const labels = {
  countLabel: 'Questions',
  daysLabel: 'Days',
  loadingText: 'Loading stats...',
  errorText: 'Could not load stats.',
  retryAccessibilityLabel: 'Retry loading stats',
  emptyIcon: 'bar-chart-outline' as const,
  emptySubtitle: 'Start a quiz to see your progress',
};

describe('PracticeStatsView states', () => {
  test('surfaces a weights-load error with a retry action', () => {
    const onRetry = jest.fn();
    render(
      <PracticeStatsView
        sessions={[{ day: '2026-07-26', count: 4, correct: 3 }]}
        sessionsLoaded
        sessionsLoadError={false}
        weights={{}}
        weightsLoaded={false}
        weightsLoadError
        onRetry={onRetry}
        labels={labels}
      />,
    );

    expect(screen.getByText('Weak-area data could not be loaded.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retry loading weak-area data'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('fresh-install empty state replaces zero cards and calendar', () => {
    render(
      <PracticeStatsView
        sessions={[]}
        sessionsLoaded
        sessionsLoadError={false}
        weights={{}}
        weightsLoaded
        weightsLoadError={false}
        onRetry={jest.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByText('No stats yet')).toBeTruthy();
    expect(screen.queryByText('All Time')).toBeNull();
    expect(screen.queryByText('Activity')).toBeNull();
  });
});
