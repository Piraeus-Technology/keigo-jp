import { dateToDayKey, getTodayKey } from './dayKey';

// Build a month grid of week rows (Monday-first), padding partial weeks
// with nulls. month is 0-based like Date.
export function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1; // Monday = 0, Sunday = 6
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export function buildDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateFromDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Consecutive-day activity streak ending today (or yesterday, so the streak
// doesn't read as broken before the user practices today).
export function computeStreak(
  hasActivity: (dayKey: string) => boolean,
  todayKey: string = getTodayKey(),
): number {
  let count = 0;
  const today = dateFromDayKey(todayKey);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (hasActivity(todayKey) || hasActivity(dateToDayKey(yesterday))) {
    const checkDate = new Date(today);
    if (!hasActivity(todayKey)) checkDate.setDate(checkDate.getDate() - 1);
    while (hasActivity(dateToDayKey(checkDate))) {
      count++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }
  return count;
}
