import { isValidDayKey, normalizeStoredDayKey, timestampToDayKey } from './dayKey';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

export function parsePersistedDay(
  value: Record<string, unknown>,
): { day: string; migrated: boolean } | null {
  if (typeof value.day === 'string') {
    const normalized = normalizeStoredDayKey(value.day);
    if (!isValidDayKey(normalized)) return null;
    return { day: normalized, migrated: normalized !== value.day };
  }

  if (typeof value.date === 'number' && Number.isFinite(value.date)) {
    const day = timestampToDayKey(value.date);
    return isValidDayKey(day) ? { day, migrated: true } : null;
  }

  return null;
}
