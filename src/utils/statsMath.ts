export function hasPositiveCount(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function getAccuracyPercent(correct: number, total: number): number | null {
  if (!hasPositiveCount(total)) return null;
  return Math.round((correct / total) * 100);
}
