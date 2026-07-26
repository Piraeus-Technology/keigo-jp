const DAY_MS = 86_400_000;

export function getDailyItemIndex(date: Date, itemCount: number): number {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    throw new Error('itemCount must be a positive integer');
  }

  // Use the local calendar components to define the day, then UTC only as a
  // stable ordinal calculation. The index therefore advances at local
  // midnight rather than at the UTC boundary.
  const localDayOrdinal = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
  return localDayOrdinal % itemCount;
}

export function millisecondsUntilNextLocalDay(date: Date): number {
  const nextDay = new Date(date);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1, nextDay.getTime() - date.getTime());
}
