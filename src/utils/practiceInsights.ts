import verbs from '../data/verbs.json';
import type { VerbData } from './keigoTypes';

// Spaced-repetition weights are keyed by the bare verb (the verbs.json key) and
// shared across quiz + flashcards. The only insight we can derive is which verbs
// the user struggles with most. Expression-card weights share the same store but
// aren't surfaced here (no verbMap entry), so they're simply skipped.
const verbMap = verbs as Record<string, VerbData>;

const WEAK_VERB_LIMIT = 5;
// A verb sits at the default weight (1) until answered; weights climb above 1
// on misses and fall below on correct answers. Only weights > 1 are "weak".
const DEFAULT_WEIGHT = 1;

export interface WeakVerb {
  verb: string; // verbs.json key
  reading: string;
  weight: number;
}

export interface PracticeInsights {
  weakVerbs: WeakVerb[];
}

export function buildPracticeInsights(weights: Record<string, number>): PracticeInsights {
  const weakVerbs = Object.entries(weights)
    .filter(([verb, weight]) => weight > DEFAULT_WEIGHT && verbMap[verb])
    .sort((a, b) => b[1] - a[1])
    .slice(0, WEAK_VERB_LIMIT)
    .map(([verb, weight]) => ({
      verb,
      reading: verbMap[verb].reading,
      weight,
    }));

  return { weakVerbs };
}
