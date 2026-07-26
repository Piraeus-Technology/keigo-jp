import { getDailyItemIndex, millisecondsUntilNextLocalDay } from '../utils/dailyItem';

describe('daily item selection', () => {
  test('stays stable throughout the same local calendar day', () => {
    const morning = new Date(2026, 6, 26, 0, 1);
    const evening = new Date(2026, 6, 26, 23, 59);

    expect(getDailyItemIndex(morning, 106)).toBe(getDailyItemIndex(evening, 106));
  });

  test('advances when local midnight is crossed', () => {
    const beforeMidnight = new Date(2026, 6, 26, 23, 59, 59);
    const afterMidnight = new Date(2026, 6, 27, 0, 0, 1);

    expect(getDailyItemIndex(afterMidnight, 106))
      .toBe((getDailyItemIndex(beforeMidnight, 106) + 1) % 106);
  });

  test('computes the delay to the next local midnight', () => {
    const noon = new Date(2026, 6, 26, 12, 0, 0);
    expect(millisecondsUntilNextLocalDay(noon)).toBe(12 * 60 * 60 * 1000);
  });
});
