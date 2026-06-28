import { getAccuracyPercent, hasPositiveCount } from '../utils/statsMath';
import { buildCalendarWeeks, buildDayKey, computeStreak } from '../utils/activityCalendar';
import { buildPracticeInsights } from '../utils/practiceInsights';

describe('statsMath', () => {
  test('hasPositiveCount', () => {
    expect(hasPositiveCount(0)).toBe(false);
    expect(hasPositiveCount(5)).toBe(true);
    expect(hasPositiveCount(null)).toBe(false);
    expect(hasPositiveCount(undefined)).toBe(false);
  });

  test('getAccuracyPercent rounds and guards zero total', () => {
    expect(getAccuracyPercent(8, 10)).toBe(80);
    expect(getAccuracyPercent(3, 4)).toBe(75);
    expect(getAccuracyPercent(0, 0)).toBeNull();
  });
});

describe('activityCalendar', () => {
  test('buildCalendarWeeks covers every day in order with 7-cell rows', () => {
    const weeks = buildCalendarWeeks(2026, 5); // June 2026 (0-based month)
    weeks.forEach(week => expect(week.length).toBe(7));
    const days = weeks.flat().filter((d): d is number => d !== null);
    expect(days).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  test('buildDayKey zero-pads', () => {
    expect(buildDayKey(2026, 5, 3)).toBe('2026-06-03');
  });

  test('computeStreak counts consecutive active days ending today', () => {
    const active = new Set(['2026-06-17', '2026-06-16', '2026-06-15']);
    expect(computeStreak((k) => active.has(k), '2026-06-17')).toBe(3);
  });

  test('computeStreak still counts when only yesterday is active', () => {
    const active = new Set(['2026-06-16']);
    expect(computeStreak((k) => active.has(k), '2026-06-17')).toBe(1);
  });

  test('computeStreak is zero when neither today nor yesterday active', () => {
    const active = new Set(['2026-06-10']);
    expect(computeStreak((k) => active.has(k), '2026-06-17')).toBe(0);
  });
});

describe('practiceInsights (bare-verb weights)', () => {
  test('ranks verbs above default weight, attaches readings, excludes unknown keys', () => {
    const { weakVerbs } = buildPracticeInsights({
      飲む: 3,
      食べる: 1.5,
      する: 1, // at default weight — not weak
      不明な動詞: 5, // not in verbs.json — excluded
    });
    expect(weakVerbs.map(v => v.verb)).toEqual(['飲む', '食べる']);
    expect(weakVerbs[0]).toMatchObject({ verb: '飲む', reading: 'のむ', weight: 3 });
    expect(weakVerbs.every(v => v.reading.length > 0)).toBe(true);
  });

  test('caps the list at 5', () => {
    const weights: Record<string, number> = {};
    // many real verbs above default weight
    ['飲む', '食べる', '行く', '見る', '来る', '話す', '書く'].forEach((v, i) => {
      weights[v] = 2 + i;
    });
    expect(buildPracticeInsights(weights).weakVerbs.length).toBe(5);
  });
});
