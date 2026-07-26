import verbs from '../data/verbs.json';
import {
  buildVerbSearchDocument,
  searchKeigo,
} from '../utils/search';
import type { VerbData } from '../utils/keigoTypes';

describe('keigo search', () => {
  test('finds non-adjacent English words in the same translation', () => {
    const results = searchKeigo('ask name');

    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        translation: expect.stringMatching(/ask your name/i),
        type: 'expression',
      }),
    ]));
  });

  test('keeps single-word Fuse search behavior', () => {
    const results = searchKeigo('receive');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) =>
      result.translation.toLowerCase().includes('receive')
      || result.key.includes('頂')
      || result.key.includes('受')
    )).toBe(true);
  });

  test('returns an empty array for a genuine no-result query', () => {
    expect(searchKeigo('zyxwv impossiblephrase')).toEqual([]);
  });

  test('keeps self-form humble verbs searchable', () => {
    const keys = ['拝借する', '存じる', '承る', '申し上げる', '申す'];

    for (const key of keys) {
      expect(searchKeigo(key)).toEqual(expect.arrayContaining([
        expect.objectContaining({ key, type: 'verb' }),
      ]));
    }
  });

  test('does not put explicitly absent form data in the search index', () => {
    const death = (verbs as unknown as Record<string, VerbData>)['死ぬ'];
    const document = buildVerbSearchDocument('死ぬ', death);

    expect(document.kenjougo).toBe('');
    expect(document.kenjougoReading).toBe('');
  });
});
