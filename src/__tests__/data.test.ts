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
    citations?: {
      source?: unknown;
      locator?: unknown;
      url?: unknown;
    }[];
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
const B3_BATCH_ONE_SLOTS = [
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
].sort();
const OFFICIAL_GUIDANCE_SOURCE = '文化審議会「敬語の指針」';
const OFFICIAL_GUIDANCE_URL =
  'https://www.bunka.go.jp/seisaku/bunkashingikai/sokai/sokai_6/pdf/keigo_tousin.pdf';
const VERIFIED_GUIDANCE_LOCATORS = new Set([
  'printed p. 24 (PDF p. 27), 2007',
  'printed p. 26 (PDF p. 29) and printed pp. 40–41 (PDF pp. 43–44), 2007',
  'printed p. 27 (PDF p. 30) and printed pp. 40–41 (PDF pp. 43–44), 2007',
  'printed p. 28 (PDF p. 31), 2007',
  'printed p. 28 (PDF p. 31) and printed pp. 40–41 (PDF pp. 43–44), 2007',
  'printed pp. 27–28 (PDF pp. 30–31) and printed pp. 40–41 (PDF pp. 43–44), 2007',
  'printed pp. 40–41 (PDF pp. 43–44), 2007',
]);

function getContentDigest(data: unknown): {
  count: number;
  digest: string;
} {
  const protectedFields = new Set([
    'availability',
    'form',
    'reading',
    'translation',
    'pattern',
    'note',
    'humbleSubclass',
    'conditions',
    'alternatives',
    'review',
    'status',
    'rationale',
    'source',
    'locator',
    'url',
    'confidence',
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

function getExampleDemonstrationStem(form: string): string {
  if (form.endsWith('させていただく')) return form.slice(0, -1);
  if (form.endsWith('いたす')) return form.slice(0, -1);
  if (form.endsWith('なさる')) return form.slice(0, -1);
  if (form.endsWith('する')) return `${form.slice(0, -2)}し`;
  if (form === '伺う') return '伺';
  return form;
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
      'itasu',
      'nasaru',
      'o_itasu',
      'go_itasu',
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

  test('English prompt glosses never encode the answer direction', () => {
    const offenders = typedVerbEntries.filter(([, data]) =>
      /humbl|respectful|honorific/i.test(data.promptGloss || data.translation)
    );

    expect(offenders.map(([verb]) => verb)).toEqual([]);
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

  test('classifies construction shape rather than only checking membership', () => {
    expect(inferKeigoPattern('確認させていただく'))
      .toBe('sase_te_itadaku');
    expect(inferKeigoPattern('お電話になる')).toBe('o_ni_naru');
    expect(inferKeigoPattern('ご迷惑をおかけする')).toBe('go_suru');
    expect(inferKeigoPattern('ご覧になる')).toBe('special');
    expect(inferKeigoPattern('検討いたす')).toBe('itasu');
    expect(inferKeigoPattern('賛成なさる')).toBe('nasaru');
    expect(inferKeigoPattern('お待ちいたす')).toBe('o_itasu');
    expect(inferKeigoPattern('ご案内いたす')).toBe('go_itasu');
    expect(inferKeigoPattern('いたす')).toBe('special');
    expect(inferKeigoPattern('なさる')).toBe('special');
    expect(isKeigoPatternConsistent('お電話になる', 'go_ni_naru'))
      .toBe(false);
    expect(isKeigoPatternConsistent(
      '確認させていただく',
      'special',
    )).toBe(false);
    expect(isKeigoPatternConsistent('検討いたす', 'special'))
      .toBe(false);
    expect(isKeigoPatternConsistent('賛成なさる', 'special'))
      .toBe(false);
    expect(isKeigoPatternConsistent('いたす', 'itasu')).toBe(false);
    expect(isKeigoPatternConsistent('なさる', 'nasaru')).toBe(false);
  });

  test('adjudicates every B3 slot without leaving a residual worklist', () => {
    const reviewed = verbEntries.flatMap(([verb, data]) =>
      ALL_FORMS
        .filter((form) => data[form].review?.status === 'reviewed')
        .map((form) => `${verb}:${form}`)
    ).sort();
    const residual = verbEntries.flatMap(([verb, data]) =>
      ALL_FORMS
        .filter((form) => data[form].review?.status === 'needs_review')
        .map((form) => `${verb}:${form}`)
    ).sort();

    expect(reviewed).toEqual(B3_BATCH_ONE_SLOTS);
    expect(residual).toEqual([]);
  });

  test('records cited metadata and explicit humble subclasses for every B3 slot', () => {
    for (const slot of B3_BATCH_ONE_SLOTS) {
      const [verb, form] = slot.split(':') as [string, typeof ALL_FORMS[number]];
      const formData = (verbs as Record<string, VerbEntry>)[verb][form];

      expect(formData.review?.status).toBe('reviewed');
      expect(formData.review?.rationale).toEqual(expect.any(String));
      expect(formData.review?.citations).toEqual(expect.any(Array));
      expect(formData.review?.confidence).toMatch(/^(low|medium|high)$/);
      if (form === 'kenjougo') {
        expect(formData.humbleSubclass)
          .toMatch(/^kenjougo_(i|ii)$/);
      }
    }
  });

  test('uses only verified printed/PDF locator pairs for the primary guidance', () => {
    for (const slot of B3_BATCH_ONE_SLOTS) {
      const [verb, form] = slot.split(':') as [string, typeof ALL_FORMS[number]];
      const review = (verbs as Record<string, VerbEntry>)[verb][form].review;
      expect(review?.status).toBe('reviewed');
      if (review?.status !== 'reviewed') continue;

      const primaryCitations = review.citations?.filter((citation) =>
        citation.source === OFFICIAL_GUIDANCE_SOURCE
      ) ?? [];
      expect(primaryCitations).toHaveLength(1);
      expect(primaryCitations[0].url).toBe(OFFICIAL_GUIDANCE_URL);
      expect(VERIFIED_GUIDANCE_LOCATORS)
        .toContain(primaryCitations[0].locator);
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

  test('a needs-review form cannot reach any graded pool', () => {
    const source = (verbs as unknown as Record<string, VerbData>)['確認する'];
    const needsReviewData: VerbData = {
      ...source,
      kenjougo: {
        availability: 'present',
        form: '確認させていただく',
        reading: 'かくにんさせていただく',
        pattern: 'sase_te_itadaku',
        review: { status: 'needs_review' },
      },
    };

    expect(isGradableVerbForm(
      '確認する',
      needsReviewData,
      'kenjougo',
    )).toBe(false);
    expect(getGradableVerbPairs(
      [['確認する', needsReviewData]],
      ['kenjougo'],
    )).toEqual([]);
  });

  test('a condition-dependent canonical form cannot reach context-free practice', () => {
    const conditionalPairs = typedVerbEntries.flatMap(([verb, data]) =>
      GRADABLE_FORMS.flatMap((form) => {
        const formData = getVerbFormData(data, form);
        return formData.conditions ? [{ verb, data, form }] : [];
      })
    );

    expect(conditionalPairs.length).toBeGreaterThan(0);
    for (const { verb, data, form } of conditionalPairs) {
      expect(isGradableVerbForm(verb, data, form)).toBe(false);
      expect(getGradableVerbPairs([[verb, data]], [form])).toEqual([]);
    }
  });

  test('uses productive humble-II forms for the former residual slots', () => {
    const expected = {
      '確認する': '確認いたす',
      '提出する': '提出いたす',
      '対応する': '対応いたす',
    } as const;
    const data = verbs as unknown as Record<string, VerbData>;

    for (const [verb, expectedForm] of Object.entries(expected)) {
      const formData = getVerbFormData(data[verb], 'kenjougo');
      expect(formData.availability).toBe('present');
      if (formData.availability !== 'present') continue;
      expect(formData.form).toBe(expectedForm);
      expect(formData.pattern).toBe('itasu');
      expect(formData.humbleSubclass).toBe('kenjougo_ii');
      expect(formData.review?.status).toBe('reviewed');
      expect(isGradableVerbForm(verb, data[verb], 'kenjougo')).toBe(true);
    }
  });

  test.each(B3_BATCH_ONE_SLOTS)(
    '%s has an example demonstrating a conjugation of its reviewed form',
    (slot) => {
      const [verb, form] = slot.split(':') as [string, typeof ALL_FORMS[number]];
      const data = (verbs as Record<string, VerbEntry>)[verb];
      const formData = data[form];
      expect(formData.review?.status).toBe('reviewed');
      expect(formData.form).toEqual(expect.any(String));
      if (typeof formData.form !== 'string') return;

      const stem = getExampleDemonstrationStem(formData.form);
      expect(data.examples.some((example) =>
        example.type === form && example.ja.includes(stem)
      )).toBe(true);
    },
  );

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

describe('Content integrity', () => {
  test('locks the adjudicated verb content', () => {
    expect(getContentDigest(verbs)).toEqual({
      count: 2288,
      digest: '347faeb902694d1d4f12c8c5979ebcf1000f0de345f9314233f24fc4bd228aa1',
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
