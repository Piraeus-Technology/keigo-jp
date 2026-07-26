import Fuse from 'fuse.js';
import type { FuseResultMatch } from 'fuse.js';
import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import { MAX_SEARCH_RESULTS } from './constants';
import type { BusinessLevel, ExpressionData, VerbData } from './keigoTypes';

interface SearchDocument {
  key: string;
  reading: string;
  translation: string;
  level: BusinessLevel;
  type: 'verb' | 'expression';
  sonkeigo: string;
  sonkeigoReading: string;
  kenjougo: string;
  kenjougoReading: string;
  teineigo: string;
  teineigoReading: string;
}

export interface SearchResult {
  key: string;
  reading: string;
  translation: string;
  level: BusinessLevel;
  type: 'verb' | 'expression';
  matchDetail?: string;
}

const verbEntries = Object.entries(verbs as Record<string, VerbData>);
const expressionEntries = Object.entries(expressions as Record<string, ExpressionData>);

const allSearchData: SearchDocument[] = [
  ...verbEntries.map(([key, data]) => ({
    key,
    reading: data.reading,
    translation: data.translation,
    level: data.level,
    type: 'verb' as const,
    sonkeigo: data.sonkeigo.form,
    sonkeigoReading: data.sonkeigo.reading,
    kenjougo: data.kenjougo.form,
    kenjougoReading: data.kenjougo.reading,
    teineigo: data.teineigo.form,
    teineigoReading: data.teineigo.reading,
  })),
  ...expressionEntries.map(([key, data]) => ({
    key,
    reading: data.reading,
    translation: data.translation,
    level: data.level,
    type: 'expression' as const,
    sonkeigo: '',
    sonkeigoReading: '',
    kenjougo: '',
    kenjougoReading: '',
    teineigo: '',
    teineigoReading: '',
  })),
];

const KEIGO_FIELD_LABELS: Record<string, string> = {
  sonkeigo: '尊敬語',
  sonkeigoReading: '尊敬語',
  kenjougo: '謙譲語',
  kenjougoReading: '謙譲語',
  teineigo: '丁寧語',
  teineigoReading: '丁寧語',
};

const SEARCH_FIELDS: (keyof SearchDocument)[] = [
  'key',
  'reading',
  'translation',
  'sonkeigo',
  'sonkeigoReading',
  'kenjougo',
  'kenjougoReading',
  'teineigo',
  'teineigoReading',
];

const fuse = new Fuse(allSearchData, {
  keys: [
    { name: 'key', weight: 3 },
    { name: 'reading', weight: 2 },
    { name: 'translation', weight: 1.5 },
    { name: 'sonkeigo', weight: 2 },
    { name: 'sonkeigoReading', weight: 1.5 },
    { name: 'kenjougo', weight: 2 },
    { name: 'kenjougoReading', weight: 1.5 },
    { name: 'teineigo', weight: 2 },
    { name: 'teineigoReading', weight: 1.5 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  includeMatches: true,
});

function toSearchResult(
  item: SearchDocument,
  matches?: readonly FuseResultMatch[],
): SearchResult {
  let matchDetail: string | undefined;
  if (matches) {
    for (const match of matches) {
      const label = KEIGO_FIELD_LABELS[match.key ?? ''];
      if (label && match.value) {
        matchDetail = `${label}: ${match.value}`;
        break;
      }
    }
  }
  return {
    key: item.key,
    reading: item.reading,
    translation: item.translation,
    level: item.level,
    type: item.type,
    matchDetail,
  };
}

export function searchKeigo(
  query: string,
  limit = MAX_SEARCH_RESULTS,
): SearchResult[] {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  if (!normalizedQuery || limit <= 0) return [];

  const fuzzyResults = fuse.search(normalizedQuery);
  const tokens = normalizedQuery.toLowerCase().split(' ');
  const useTokenMatching = tokens.length >= 2 && tokens.every((token) => token.length >= 3);

  if (!useTokenMatching) {
    return fuzzyResults.slice(0, limit).map((result) => toSearchResult(result.item, result.matches));
  }

  const tokenMatches = allSearchData.filter((item) =>
    SEARCH_FIELDS.some((field) => {
      const value = String(item[field]).toLowerCase();
      return tokens.every((token) => value.includes(token));
    }),
  );

  const ordered = [
    ...tokenMatches.map((item) => ({ item, matches: undefined })),
    ...fuzzyResults,
  ];
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const result of ordered) {
    const identity = `${result.item.type}:${result.item.key}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    results.push(toSearchResult(result.item, result.matches));
    if (results.length === limit) break;
  }
  return results;
}
