import React from 'react';
import { render } from '@testing-library/react-native';
import StatsScreen from '../screens/StatsScreen';

let mockLastStatsViewProps: Record<string, unknown> | null = null;
const mockLoadSessions = jest.fn();
const mockLoadWeights = jest.fn();
const mockLoadStats = jest.fn();

jest.mock('../components/PracticeStatsView', () => {
  return function MockPracticeStatsView(props: Record<string, unknown>) {
    mockLastStatsViewProps = props;
    return null;
  };
});

jest.mock('../store/sessionStore', () => ({
  useSessionStore: () => ({
    sessions: [{ day: '2026-07-26', total: 4, correct: 3 }],
    loaded: true,
    loadError: false,
    loadSessions: mockLoadSessions,
  }),
}));

jest.mock('../store/spacedRepStore', () => ({
  useSpacedRepStore: () => ({
    weights: {},
    loaded: true,
    loadError: false,
    loadWeights: mockLoadWeights,
  }),
}));

jest.mock('../store/quizStore', () => ({
  useQuizStore: () => ({
    totalQuestions: 0,
    totalCorrect: 0,
    bestStreak: 0,
    loaded: false,
    loadError: true,
    loadStats: mockLoadStats,
  }),
}));

describe('StatsScreen all-time values', () => {
  beforeEach(() => {
    mockLastStatsViewProps = null;
  });

  test('does not present initial zeros as all-time stats after a failed load', () => {
    render(<StatsScreen />);

    expect(mockLastStatsViewProps).not.toBeNull();
    expect(mockLastStatsViewProps?.allTimeOverride).toBeUndefined();
  });
});
