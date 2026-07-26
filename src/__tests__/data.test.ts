import { createHash } from 'crypto';

import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import {
  getGradableVerbPairs,
  getVerbFormData,
  hasCanonicalVerbForm,
  isGradableVerbForm,
} from '../utils/gradableVerbs';
import {
  ALL_FORMS,
  ALL_LEVELS,
  GRADABLE_FORMS,
  KEIGO_PATTERNS,
  inferKeigoPattern,
  isKeigoPatternConsistent,
  isValidKeigoFormData,
} from '../utils/keigoTypes';
import type {
  AbsentKeigoFormData,
  VerbData,
} from '../utils/keigoTypes';

const VALID_EXAMPLE_TYPES = ALL_FORMS;
const VALID_CATEGORIES = ['greeting', 'opening', 'closing', 'apology', 'response', 'request', 'farewell', 'gift'];

type RawKeigoFormEntry = {
  availability: string;
  form?: string;
  reading?: string;
  pattern?: string;
  note?: string;
  humbleSubclass?: unknown;
  conditions?: unknown;
  alternatives?: unknown;
  review?: {
    status?: string;
    rationale?: unknown;
    citations?: unknown;
    confidence?: unknown;
  };
};

type VerbEntry = {
  reading: string;
  translation: string;
  level: string;
  sonkeigo: RawKeigoFormEntry;
  kenjougo: RawKeigoFormEntry;
  teineigo: RawKeigoFormEntry;
  examples: { context: string; ja: string; en: string; type: string }[];
};

type ExpressionEntry = {
  reading: string;
  translation: string;
  level: string;
  category: string;
  usage: string;
  examples: { ja: string; en: string }[];
};

const verbEntries = Object.entries(verbs as Record<string, VerbEntry>);
const expressionEntries = Object.entries(expressions as Record<string, ExpressionEntry>);
const typedVerbEntries = Object.entries(
  verbs as unknown as Record<string, VerbData>,
);

function getContentDigest(data: unknown): {
  count: number;
  digest: string;
} {
  const protectedFields = new Set([
    'form',
    'reading',
    'translation',
    'usage',
    'context',
    'ja',
    'en',
  ]);
  const values: [string, unknown][] = [];

  function visit(value: unknown, path: (string | number)[] = []) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (protectedFields.has(key)) {
        values.push([[...path, key].join('.'), child]);
      }
      visit(child, [...path, key]);
    }
  }

  visit(data);
  return {
    count: values.length,
    digest: createHash('sha256')
      .update(JSON.stringify(values))
      .digest('hex'),
  };
}

describe('Keigo form schema', () => {
  test('derives the runtime pattern whitelist from the pattern type source', () => {
    expect(KEIGO_PATTERNS).toEqual([
      'special',
      'o_ni_naru',
      'o_suru',
      'go_ni_naru',
      'go_suru',
      'sase_te_itadaku',
    ]);
  });

  test('accepts populated B3 metadata when every optional field is well-formed', () => {
    expect(isValidKeigoFormData({
      availability: 'present',
      form: 'お届けする',
      reading: 'おとどけする',
      pattern: 'o_suru',
      humbleSubclass: 'kenjougo_i',
      conditions: ['The action is directed toward a specific person.'],
      alternatives: [{
        form: 'お届けいたす',
        reading: 'おとどけいたす',
        conditions: ['Use in a more formal register.'],
      }],
      review: {
        status: 'reviewed',
        rationale: 'The construction lowers the speaker action.',
        citations: [{
          source: 'Editorial source',
          locator: 'p. 1',
          url: 'https://example.com/source',
        }],
        confidence: 'high',
      },
    })).toBe(true);
  });

  test('accepts forms with no optional B3 metadata', () => {
    expect(isValidKeigoFormData({
      availability: 'present',
      form: 'お届けする',
      reading: 'おとどけする',
      pattern: 'o_suru',
    })).toBe(true);
  });

  test.each([
    ['unknown humble sub-class', { humbleSubclass: 'other' }],
    ['empty conditions', { conditions: [] }],
    ['empty alternatives', { alternatives: [] }],
    ['unreviewed rationale', {
      review: {
        status: 'needs_review',
        rationale: 'Do not adjudicate this yet.',
      },
    }],
    ['review without citations', {
      review: {
        status: 'reviewed',
        rationale: 'A decision.',
        citations: [],
        confidence: 'high',
      },
    }],
    ['pattern contradicting form shape', { pattern: 'go_suru' }],
  ])('rejects malformed optional metadata: %s', (_name, override) => {
    expect(isValidKeigoFormData({
      availability: 'present',
      form: 'お届けする',
      reading: 'おとどけする',
      pattern: 'o_suru',
      ...override,
    })).toBe(false);
  });

  test('makes absence an explicit state with a mandatory note and no typed form value', () => {
    const absent: AbsentKeigoFormData = {
      availability: 'absent',
      note: 'There is no canonical form.',
    };

    expect(isValidKeigoFormData(absent)).toBe(true);
    // @ts-expect-error Absent form data deliberately exposes no form value.
    expect(absent.form).toBeUndefined();
    expect(isValidKeigoFormData({ availability: 'absent' })).toBe(false);
    expect(isValidKeigoFormData({
      ...absent,
      form: '',
    })).toBe(false);
    expect(isValidKeigoFormData({
      ...absent,
      form: '隠れたフォーム',
    })).toBe(false);
    expect(isValidKeigoFormData({
      ...absent,
      reading: '',
    })).toBe(false);
    expect(isValidKeigoFormData({
      ...absent,
      pattern: 'special',
    })).toBe(false);
  });

  test('distinguishes absent forms from present identity forms', () => {
    const data = verbs as unknown as Record<string, VerbData>;
    const absent = getVerbFormData(data['死ぬ'], 'kenjougo');
    const identity = getVerbFormData(data['申す'], 'kenjougo');

    expect(absent.availability).toBe('absent');
    expect(identity.availability).toBe('present');
    expect(hasCanonicalVerbForm(data['死ぬ'], 'kenjougo')).toBe(false);
    expect(hasCanonicalVerbForm(data['申す'], 'kenjougo')).toBe(true);
    if (identity.availability === 'present') {
      expect(identity.form).toBe('申す');
    }
  });
});

describe('Verb data validation', () => {
  test('verbs.json is not empty', () => {
    expect(verbEntries.length).toBeGreaterThan(0);
  });

  describe.each(verbEntries)('verb "%s"', (verbKey, verb) => {
    test('has all required fields', () => {
      expect(verb).toHaveProperty('reading');
      expect(verb).toHaveProperty('translation');
      expect(verb).toHaveProperty('level');
      expect(verb).toHaveProperty('sonkeigo');
      expect(verb).toHaveProperty('kenjougo');
      expect(verb).toHaveProperty('teineigo');
      expect(verb).toHaveProperty('examples');
    });

    test('level is valid', () => {
      expect(ALL_LEVELS).toContain(verb.level);
    });

    test('sonkeigo has availability and pattern fields', () => {
      expect(verb.sonkeigo).toHaveProperty('availability');
      expect(verb.sonkeigo).toHaveProperty('pattern');
    });

    test('kenjougo has availability and a pattern only when present', () => {
      expect(verb.kenjougo).toHaveProperty('availability');
      if (verb.kenjougo.availability === 'present') {
        expect(verb.kenjougo).toHaveProperty('pattern');
      } else {
        expect(verb.kenjougo).not.toHaveProperty('pattern');
      }
    });

    test('teineigo shares the same form-data shape', () => {
      expect(verb.teineigo).toHaveProperty('availability');
      expect(isValidKeigoFormData(verb.teineigo)).toBe(true);
    });

    test('sonkeigo pattern is valid and consistent with its form', () => {
      expect(KEIGO_PATTERNS).toContain(verb.sonkeigo.pattern);
      expect(isKeigoPatternConsistent(
        verb.sonkeigo.form ?? '',
        verb.sonkeigo.pattern as typeof KEIGO_PATTERNS[number],
      )).toBe(true);
    });

    test('kenjougo pattern is valid and consistent with its form', () => {
      if (verb.kenjougo.availability === 'present') {
        expect(KEIGO_PATTERNS).toContain(verb.kenjougo.pattern);
        expect(isKeigoPatternConsistent(
          verb.kenjougo.form ?? '',
          verb.kenjougo.pattern as typeof KEIGO_PATTERNS[number],
        )).toBe(true);
      } else {
        expect(verb.kenjougo.pattern).toBeUndefined();
      }
    });

    test('examples is a non-empty array', () => {
      expect(Array.isArray(verb.examples)).toBe(true);
      expect(verb.examples.length).toBeGreaterThan(0);
    });

    test('each example has context, ja, en, type fields', () => {
      verb.examples.forEach((example) => {
        expect(example).toHaveProperty('context');
        expect(example).toHaveProperty('ja');
        expect(example).toHaveProperty('en');
        expect(example).toHaveProperty('type');
      });
    });

    test('each example type is valid', () => {
      verb.examples.forEach((example) => {
        expect(VALID_EXAMPLE_TYPES).toContain(example.type);
      });
    });

    test('required values are populated unless a form is explicitly absent', () => {
      expect(verbKey.trim()).not.toBe('');
      expect(verb.reading.trim()).not.toBe('');
      expect(verb.translation.trim()).not.toBe('');
      expect(verb.level.trim()).not.toBe('');
      for (const formData of [
        verb.sonkeigo,
        verb.kenjougo,
        verb.teineigo,
      ]) {
        expect(isValidKeigoFormData(formData)).toBe(true);
        if (formData.availability === 'present') {
          expect(formData.form?.trim()).toBeTruthy();
          expect(formData.reading?.trim()).toBeTruthy();
        } else {
          expect(formData.note?.trim()).toBeTruthy();
          expect(formData).not.toHaveProperty('form');
          expect(formData).not.toHaveProperty('reading');
          expect(formData).not.toHaveProperty('pattern');
        }
      }
    });

    test('no empty string values in examples', () => {
      verb.examples.forEach((example) => {
        expect(example.context.trim()).not.toBe('');
        expect(example.ja.trim()).not.toBe('');
        expect(example.en.trim()).not.toBe('');
        expect(example.type.trim()).not.toBe('');
      });
    });

    test('reading field contains only hiragana/katakana/kanji characters', () => {
      const hiraganaOnly = /^[\u3040-\u309Fー]+$/;
      expect(verb.reading).toMatch(hiraganaOnly);
    });
  });

  test('has the expected mechanically consistent pattern distribution', () => {
    const distribution = (form: 'sonkeigo' | 'kenjougo') =>
      verbEntries.reduce<Record<string, number>>((counts, [, data]) => {
        const pattern = data[form].pattern;
        if (!pattern) return counts;
        counts[pattern] = (counts[pattern] ?? 0) + 1;
        return counts;
      }, {});

    expect(distribution('sonkeigo')).toEqual({
      special: 17,
      o_ni_naru: 57,
      go_ni_naru: 32,
    });
    expect(distribution('kenjougo')).toEqual({
      special: 35,
      o_suru: 32,
      sase_te_itadaku: 25,
      go_suru: 13,
    });
  });

  test('classifies construction shape rather than only checking membership', () => {
    expect(inferKeigoPattern('確認させていただく'))
      .toBe('sase_te_itadaku');
    expect(inferKeigoPattern('お電話になる')).toBe('o_ni_naru');
    expect(inferKeigoPattern('ご迷惑をおかけする')).toBe('go_suru');
    expect(inferKeigoPattern('ご覧になる')).toBe('special');
    expect(isKeigoPatternConsistent('お電話になる', 'go_ni_naru'))
      .toBe(false);
    expect(isKeigoPatternConsistent(
      '確認させていただく',
      'special',
    )).toBe(false);
  });

  test('enumerates the exact B3 review worklist without adjudicating it', () => {
    const flagged = verbEntries.flatMap(([verb, data]) =>
      ALL_FORMS
        .filter((form) => data[form].review?.status === 'needs_review')
        .map((form) => `${verb}:${form}`)
    ).sort();

    expect(flagged).toEqual([
      '出る:kenjougo',
      '出席する:kenjougo',
      '利用する:kenjougo',
      '参加する:kenjougo',
      '反対する:kenjougo',
      '反対する:sonkeigo',
      '変える:kenjougo',
      '始める:kenjougo',
      '対応する:kenjougo',
      '承認する:kenjougo',
      '提出する:kenjougo',
      '検討する:kenjougo',
      '死ぬ:teineigo',
      '決める:kenjougo',
      '注文する:kenjougo',
      '理解する:kenjougo',
      '着る:kenjougo',
      '確認する:kenjougo',
      '考える:kenjougo',
      '記入する:kenjougo',
      '訪問する:kenjougo',
      '賛成する:kenjougo',
      '賛成する:sonkeigo',
      '質問する:kenjougo',
      '辞退する:kenjougo',
      '遠慮する:kenjougo',
      '遠慮する:sonkeigo',
      '閉める:kenjougo',
      '開ける:kenjougo',
    ]);
    expect(flagged.filter((item) => item.endsWith(':kenjougo')))
      .toHaveLength(25);
  });

  test('does not populate B3 adjudication fields during schema migration', () => {
    for (const [, data] of verbEntries) {
      for (const form of ALL_FORMS) {
        expect(data[form].humbleSubclass).toBeUndefined();
        expect(data[form].conditions).toBeUndefined();
        expect(data[form].alternatives).toBeUndefined();
        if (data[form].review?.status === 'needs_review') {
          expect(data[form].review).toEqual({ status: 'needs_review' });
        }
      }
    }
  });

  test('keeps the practice form set exactly respectful plus humble', () => {
    expect(GRADABLE_FORMS).toEqual(['sonkeigo', 'kenjougo']);
    expect(GRADABLE_FORMS).not.toContain('teineigo');
  });

  test('every gradable verb/form pair has an answer distinct from its prompt', () => {
    const pairs = getGradableVerbPairs(typedVerbEntries, ALL_FORMS);

    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every(({ verb, formData }) =>
      formData.form !== verb
    )).toBe(true);
  });

  test('an absent form cannot reach any graded pool', () => {
    const death = typedVerbEntries.find(([verb]) => verb === '死ぬ')!;
    const pairs = getGradableVerbPairs([death], ALL_FORMS);

    expect(pairs.some(({ form }) => form === 'kenjougo')).toBe(false);
    expect(isGradableVerbForm('死ぬ', death[1], 'kenjougo')).toBe(false);
  });

  test('derives pair-level exclusions while preserving other forms on the same records', () => {
    const identityPairs = typedVerbEntries.flatMap(([verb, data]) =>
      ALL_FORMS.flatMap((form) => {
        const formData = getVerbFormData(data, form);
        return formData.availability === 'present'
          && formData.form === verb
          ? [{ verb, form }]
          : [];
      })
    );

    expect(identityPairs).toEqual(expect.arrayContaining([
      { verb: '拝借する', form: 'kenjougo' },
      { verb: '存じる', form: 'kenjougo' },
      { verb: '承る', form: 'kenjougo' },
      { verb: '申し上げる', form: 'kenjougo' },
      { verb: '申す', form: 'kenjougo' },
    ]));
    for (const { verb, form } of identityPairs) {
      const data = (verbs as unknown as Record<string, VerbData>)[verb];
      expect(isGradableVerbForm(verb, data, form)).toBe(false);
      expect(ALL_FORMS.some((otherForm) =>
        isGradableVerbForm(verb, data, otherForm)
      )).toBe(true);
    }
  });

  test('uses consistent forms and examples for the corrected verb records', () => {
    const data = verbs as unknown as Record<string, VerbData>;
    const giving = getVerbFormData(data['あげる'], 'sonkeigo');
    const receiving = getVerbFormData(data['承る'], 'sonkeigo');
    const death = getVerbFormData(data['死ぬ'], 'kenjougo');

    expect(giving.availability).toBe('present');
    if (giving.availability === 'present') {
      expect(giving.form).toBe('お与えになる');
    }
    expect(data['あげる'].examples.some((example) =>
      example.type === 'sonkeigo' && example.ja.includes('お与えにな')
    )).toBe(true);

    expect(receiving.availability).toBe('present');
    if (receiving.availability === 'present') {
      expect(receiving.form).toBe('お聞きになる');
    }
    expect(data['承る'].examples.some((example) =>
      example.type === 'sonkeigo' && example.ja.includes('お聞きにな')
    )).toBe(true);

    expect(death.availability).toBe('absent');
    expect(death.note).toMatch(/no canonical humble form/i);
    expect(isGradableVerbForm('死ぬ', data['死ぬ'], 'kenjougo'))
      .toBe(false);
    expect(data['死ぬ'].examples.some((example) =>
      example.type === 'kenjougo'
    )).toBe(false);
  });
});

describe('Content-neutral migration integrity', () => {
  test('preserves verb content except removed absent-form sentinel values', () => {
    expect(getContentDigest(verbs)).toEqual({
      count: 1479,
      digest: 'f3540714ef2ada670df27fbb7335466be52e1679166e941adfb995ebe9e0b56e',
    });
  });

  test('preserves every protected expression content value', () => {
    expect(getContentDigest(expressions)).toEqual({
      count: 315,
      digest: '1aa5223c539a4a8c4e3aee7882cf9e5cd1fe600b0d98d7b9fa4157e3f41bba55',
    });
  });
});

describe('Expression data validation', () => {
  test('expressions.json is not empty', () => {
    expect(expressionEntries.length).toBeGreaterThan(0);
  });

  test('graded translation prompts are unique', () => {
    const normalizedPrompts = expressionEntries.map(([, expression]) =>
      expression.translation.trim().toLocaleLowerCase()
    );

    expect(new Set(normalizedPrompts).size).toBe(normalizedPrompts.length);
  });

  describe.each(expressionEntries)('expression "%s"', (exprKey, expr) => {
    test('has all required fields', () => {
      expect(expr).toHaveProperty('reading');
      expect(expr).toHaveProperty('translation');
      expect(expr).toHaveProperty('level');
      expect(expr).toHaveProperty('category');
      expect(expr).toHaveProperty('usage');
      expect(expr).toHaveProperty('examples');
    });

    test('level is valid', () => {
      expect(ALL_LEVELS).toContain(expr.level);
    });

    test('category is valid', () => {
      expect(VALID_CATEGORIES).toContain(expr.category);
    });

    test('examples is a non-empty array', () => {
      expect(Array.isArray(expr.examples)).toBe(true);
      expect(expr.examples.length).toBeGreaterThan(0);
    });

    test('each example has ja and en fields', () => {
      expr.examples.forEach((example) => {
        expect(example).toHaveProperty('ja');
        expect(example).toHaveProperty('en');
      });
    });

    test('no empty string values for required fields', () => {
      expect(exprKey.trim()).not.toBe('');
      expect(expr.reading.trim()).not.toBe('');
      expect(expr.translation.trim()).not.toBe('');
      expect(expr.level.trim()).not.toBe('');
      expect(expr.category.trim()).not.toBe('');
      expect(expr.usage.trim()).not.toBe('');
    });

    test('no empty string values in examples', () => {
      expr.examples.forEach((example) => {
        expect(example.ja.trim()).not.toBe('');
        expect(example.en.trim()).not.toBe('');
      });
    });
  });
});
