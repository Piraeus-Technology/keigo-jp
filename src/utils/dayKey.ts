// Local-timezone YYYY-MM-DD keys for persisted daily records. Formatted
// manually instead of via toLocaleDateString('en-CA'): the locale trick
// depends on Intl data that Hermes builds may lack or change, and since
// these strings are a persisted schema key, a format drift would break
// day equality checks, descending sorts, and create duplicate days.
export function dateToDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayKey(): string {
  return dateToDayKey(new Date());
}

export function timestampToDayKey(timestamp: number): string {
  return dateToDayKey(new Date(timestamp));
}

export function isValidDayKey(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;

  const [year, month, date] = day.split('-').map(Number);
  if (year < 1970 || year > 9999) return false;
  const parsed = new Date(year, month - 1, date);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === date;
}

export function normalizeStoredDayKey(day: string): string {
  if (isValidDayKey(day)) return day;
  // A value that claims to use the persisted schema but is not a real
  // calendar date is corrupt, not a legacy format to normalize.
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;

  const parsed = new Date(day);
  if (!Number.isFinite(parsed.getTime())) return day;

  return dateToDayKey(parsed);
}
