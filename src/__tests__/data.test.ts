import { createHash } from 'crypto';

import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import {
  getCanonicalRegister,
  getGradableAlternatives,
  getGradableVerbPairs,
  isAskableVerbForm,
  getVerbFormData,
  hasCanonicalVerbForm,
  isGradableVerbForm,
} from '../utils/gradableVerbs';
import {
  ALL_FORMS,
  ALL_LEVELS,
  GRADABLE_FORMS,
  KEIGO_PATTERNS,
  KEIGO_REGISTERS,
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
  patternSource?: unknown;
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
  // Adjudicated later, when the godan causative classifier stopped hiding them.
  '寝る:kenjougo',
  '使う:kenjougo',
  '終わる:kenjougo',
  '入る:kenjougo',
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

type PassiveClass = 'godan' | 'ichidan' | 'kuru' | 'suru';

const NEW_PASSIVE_ALTERNATIVES = [
  ['言う', 'godan'],
  ['行く', 'godan'],
  ['来る', 'kuru'],
  ['する', 'suru'],
  ['食べる', 'ichidan'],
  ['飲む', 'godan'],
  ['見る', 'ichidan'],
  ['知る', 'godan'],
  ['座る', 'godan'],
  ['寝る', 'ichidan'],
  ['着る', 'ichidan'],
  ['賛成する', 'suru'],
  ['反対する', 'suru'],
  ['遠慮する', 'suru'],
] as const satisfies readonly (readonly [string, PassiveClass])[];

function derivePassive(value: string, verbClass: PassiveClass): string {
  if (verbClass === 'kuru') return value === 'くる' ? 'こられる' : '来られる';
  if (verbClass === 'suru') return `${value.slice(0, -2)}される`;
  if (verbClass === 'ichidan') return `${value.slice(0, -1)}られる`;

  const aRow: Record<string, string> = {
    'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ', 'つ': 'た',
    'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら',
  };
  const ending = value.at(-1) ?? '';
  const stemEnding = aRow[ending];
  if (!stemEnding) throw new Error(`Unsupported godan ending: ${ending}`);
  return `${value.slice(0, -1)}${stemEnding}れる`;
}

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
    'patternSource',
    'note',
    'humbleSubclass',
    'conditions',
    'alternatives',
    'register',
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

function getExampleDemonstrationStem(
  form: string,
  sourceVerb: string,
  politeForm?: string,
): string {
  // Ask the shared classifier rather than re-matching the pattern here. This
  // line used to test `endsWith('させていただく')`, the same incomplete match
  // that hid the godan causatives from `inferKeigoPattern` — so the helper
  // meant to police the data carried the identical blind spot.
  if (inferKeigoPattern(form, sourceVerb, politeForm) === 'sase_te_itadaku') {
    return form.slice(0, -1);
  }
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
        register: 'more_formal',
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

  test('rejects two alternatives that would share one register-labelled prompt', () => {
    expect(isValidKeigoFormData({
      availability: 'present',
      form: 'お届けする',
      reading: 'おとどけする',
      pattern: 'o_suru',
      alternatives: [
        { form: 'お届けいたす', reading: 'おとどけいたす', register: 'more_formal' },
        { form: 'お届け申し上げる', reading: 'おとどけもうしあげる', register: 'more_formal' },
      ],
    })).toBe(false);
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
    const answerDirectionPattern = /humbl|respectful|honorific|\b(?:to|by|from)\s+(?:(?:a|an|the|your)\s+)?(?:superior|customer|client)\b/i;
    const directionMarkers = [
      'humble',
      'respectful',
      'honorific',
      'to state / to express (to a superior)',
      'to a customer',
      'by a superior',
      'from a client',
    ];
    const offenders = typedVerbEntries.filter(([, data]) =>
      answerDirectionPattern.test(data.promptGloss || data.translation)
    );

    expect(directionMarkers.every((marker) =>
      answerDirectionPattern.test(marker)
    )).toBe(true);
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

    test('sonkeigo has availability and a pattern only when present', () => {
      expect(verb.sonkeigo).toHaveProperty('availability');
      if (verb.sonkeigo.availability === 'present') {
        expect(verb.sonkeigo).toHaveProperty('pattern');
      } else {
        expect(verb.sonkeigo).not.toHaveProperty('pattern');
      }
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
      expect(isValidKeigoFormData(
        verb.teineigo,
        verbKey,
        verb.teineigo.form,
      )).toBe(true);
    });

    test('sonkeigo pattern is valid and consistent with its form', () => {
      if (verb.sonkeigo.availability === 'present') {
        expect(KEIGO_PATTERNS).toContain(verb.sonkeigo.pattern);
        expect(isKeigoPatternConsistent(
          verb.sonkeigo.form ?? '',
          verb.sonkeigo.pattern as typeof KEIGO_PATTERNS[number],
          typeof verb.sonkeigo.patternSource === 'string'
            ? verb.sonkeigo.patternSource
            : verbKey,
          verb.teineigo.form,
        )).toBe(true);
      } else {
        expect(verb.sonkeigo.pattern).toBeUndefined();
      }
    });

    test('kenjougo pattern is valid and consistent with its form', () => {
      if (verb.kenjougo.availability === 'present') {
        expect(KEIGO_PATTERNS).toContain(verb.kenjougo.pattern);
        expect(isKeigoPatternConsistent(
          verb.kenjougo.form ?? '',
          verb.kenjougo.pattern as typeof KEIGO_PATTERNS[number],
          typeof verb.kenjougo.patternSource === 'string'
            ? verb.kenjougo.patternSource
            : verbKey,
          verb.teineigo.form,
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
        expect(isValidKeigoFormData(
          formData,
          verbKey,
          verb.teineigo.form,
        )).toBe(true);
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

  test('never attaches an example to a form marked absent', () => {
    const offenders = typedVerbEntries.flatMap(([verb, data]) =>
      data.examples
        .filter((example) =>
          getVerbFormData(data, example.type).availability === 'absent'
        )
        .map((example) => `${verb}:${example.type}`)
    );

    expect(offenders).toEqual([]);
  });

  test('classifies construction shape rather than only checking membership', () => {
    expect(inferKeigoPattern('確認させていただく', '確認する'))
      .toBe('sase_te_itadaku');
    expect(inferKeigoPattern('使わせていただく', '使う'))
      .toBe('sase_te_itadaku');
    expect(inferKeigoPattern('着させていただく', '着る', '着ます'))
      .toBe('sase_te_itadaku');
    expect(inferKeigoPattern('入らせていただく', '入る', '入ります'))
      .toBe('sase_te_itadaku');
    expect(inferKeigoPattern('お電話になる', '電話する')).toBe('o_ni_naru');
    expect(inferKeigoPattern('ご迷惑をおかけする', '迷惑をかける')).toBe('go_suru');
    expect(inferKeigoPattern('ご覧になる', '見る')).toBe('special');
    expect(inferKeigoPattern('検討いたす', '検討する')).toBe('itasu');
    expect(inferKeigoPattern('賛成なさる', '賛成する')).toBe('nasaru');
    expect(inferKeigoPattern('お待ちいたす', '待つ')).toBe('o_itasu');
    expect(inferKeigoPattern('ご案内いたす', '案内する')).toBe('go_itasu');
    expect(inferKeigoPattern('いたす', 'する')).toBe('special');
    expect(inferKeigoPattern('なさる', 'する')).toBe('special');
    expect(isKeigoPatternConsistent('お電話になる', 'go_ni_naru', '電話する'))
      .toBe(false);
    expect(isKeigoPatternConsistent(
      '確認させていただく',
      'special',
      '確認する',
    )).toBe(false);
    expect(isKeigoPatternConsistent('検討いたす', 'special', '検討する'))
      .toBe(false);
    expect(isKeigoPatternConsistent('賛成なさる', 'special', '賛成する'))
      .toBe(false);
    expect(isKeigoPatternConsistent('いたす', 'itasu', 'する')).toBe(false);
    expect(isKeigoPatternConsistent('なさる', 'nasaru', 'する')).toBe(false);
  });

  test('uses the source verb to reject lexical 〜せる stems', () => {
    for (const [form, source, polite] of [
      ['見せていただく', '見せる', '見せます'],
      ['合わせていただく', '合わせる', '合わせます'],
      ['知らせていただく', '知らせる', '知らせます'],
      ['済ませていただく', '済ませる', '済ませます'],
      ['聞かせていただく', '聞かせる', '聞かせます'],
    ] as const) {
      expect(inferKeigoPattern(form, source, polite)).toBe('special');
    }
    expect(inferKeigoPattern('聞かせていただく', '聞く'))
      .toBe('sase_te_itadaku');
  });

  test('fails closed for ambiguous る-source verbs without polite class evidence', () => {
    expect(inferKeigoPattern('食べさせていただく', '食べる'))
      .toBe('special');
    expect(inferKeigoPattern('食べさせていただく', '食べる', '食べています'))
      .toBe('special');
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
    const pairs = getGradableVerbPairs(typedVerbEntries, GRADABLE_FORMS);

    // 191, not the askable 201: this pool is the context-free one, so the ten
    // permission-and-benefit forms are excluded from it by design.
    expect(pairs).toHaveLength(191);
    expect(pairs.every(({ verb, formData }) =>
      formData.form !== verb
    )).toBe(true);
    expect(pairs.every(({ formData }) =>
      formData.conditions === undefined
    )).toBe(true);
  });

  test('graded English prompts are unique within each requested form', () => {
    const promptKeys = getGradableVerbPairs(
      typedVerbEntries,
      GRADABLE_FORMS,
    ).map(({ data, form }) =>
      `${form}:${(data.promptGloss || data.translation).trim().toLowerCase()}`
    );

    expect(new Set(promptKeys).size).toBe(promptKeys.length);
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

      const stem = getExampleDemonstrationStem(
        formData.form,
        typeof formData.patternSource === 'string'
          ? formData.patternSource
          : verb,
        data.teineigo.form,
      );
      expect(data.examples.some((example) =>
        example.type === form && example.ja.includes(stem)
      )).toBe(true);
    },
  );

  test('excludes identity pairs and fully consolidates identity records', () => {
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
    }

    for (const verb of [
      '拝借する',
      '存じる',
      '承る',
      '申し上げる',
      '申す',
    ]) {
      const data = (verbs as unknown as Record<string, VerbData>)[verb];
      expect(data).toBeDefined();
      expect(getGradableVerbPairs([[verb, data]], GRADABLE_FORMS))
        .toEqual([]);
    }
  });

  test('keeps context-selected humble forms visible but out of practice', () => {
    const data = verbs as unknown as Record<string, VerbData>;
    const expected = [
      ['言う', { form: '申し上げる', reading: 'もうしあげる', register: 'contextual' }],
      ['聞く', { form: '承る', reading: 'うけたまわる', register: 'contextual' }],
    ] as const;

    for (const [verb, alternative] of expected) {
      const formData = getVerbFormData(data[verb], 'kenjougo');
      expect(formData.availability).toBe('present');
      expect(formData.alternatives).toEqual(
        expect.arrayContaining([alternative]),
      );
      expect(getGradableAlternatives(verb, data[verb], 'kenjougo'))
        .not.toEqual(expect.arrayContaining([expect.objectContaining({
          form: alternative.form,
        })]));
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

    expect(receiving.availability).toBe('absent');
    expect(receiving.note).toMatch(
      /inherently humble.*聞く.*お聞きになる/i,
    );
    expect(data['承る'].examples.some((example) =>
      example.type === 'sonkeigo'
    )).toBe(false);

    expect(death.availability).toBe('absent');
    expect(death.note).toMatch(/no canonical humble form/i);
    expect(isGradableVerbForm('死ぬ', data['死ぬ'], 'kenjougo'))
      .toBe(false);
    expect(data['死ぬ'].examples.some((example) =>
      example.type === 'kenjougo'
    )).toBe(false);
  });
});

describe('Alternative register metadata', () => {
  const alternativeSlots = typedVerbEntries.flatMap(([verb, data]) =>
    GRADABLE_FORMS.flatMap((form) => {
      const formData = getVerbFormData(data, form);
      if (formData.availability === 'absent' || !formData.alternatives) return [];
      return [{ verb, data, form, formData, alternatives: formData.alternatives }];
    })
  );

  test('every alternative declares a register from the shared whitelist', () => {
    expect(alternativeSlots.length).toBeGreaterThan(0);
    for (const { verb, form, alternatives } of alternativeSlots) {
      for (const alternative of alternatives) {
        expect({
          verb,
          form,
          register: alternative.register,
          known: (KEIGO_REGISTERS as readonly string[]).includes(alternative.register),
        }).toEqual({ verb, form, register: alternative.register, known: true });
        expect(alternative.form.trim()).not.toBe('');
        expect(alternative.reading.trim()).not.toBe('');
      }
    }
  });

  test('an alternative never repeats the prompt, the canonical answer or a sibling', () => {
    for (const { verb, form, formData, alternatives } of alternativeSlots) {
      const seen = new Set<string>();
      for (const alternative of alternatives) {
        expect({ verb, form, clashesWithCanonical: alternative.form === formData.form })
          .toEqual({ verb, form, clashesWithCanonical: false });
        expect({ verb, form, clashesWithPrompt: alternative.form === verb })
          .toEqual({ verb, form, clashesWithPrompt: false });
        expect({ verb, form, duplicate: seen.has(alternative.form) })
          .toEqual({ verb, form, duplicate: false });
        seen.add(alternative.form);
      }
    }
  });

  test('keeps permission-dependent and contextual alternatives out of practice', () => {
    for (const { verb, data, form, alternatives } of alternativeSlots) {
      const askable = getGradableAlternatives(verb, data, form).map((a) => a.form);
      for (const alternative of alternatives) {
        const conditional = alternative.conditions !== undefined;
        // when_granted and "has conditions" must agree in both directions, since
        // that equivalence is the whole reason a conditional form cannot be asked
        // for on a context-free card.
        expect({
          verb,
          form: alternative.form,
          conditional,
          whenGranted: alternative.register === 'when_granted',
        }).toEqual({
          verb,
          form: alternative.form,
          conditional,
          whenGranted: conditional,
        });
        const contextFree = !conditional && alternative.register !== 'contextual';
        expect({ form: alternative.form, askable: askable.includes(alternative.form) })
          .toEqual({ form: alternative.form, askable: contextFree });
      }
    }
  });

  test('treats every させていただく form the same way, whatever its verb class', () => {
    // The split used to track a regex gap: a godan causative ends in ませて /
    // わせて / らせて, so `させていただく` matched only the ichidan and サ変
    // forms, and only those got conditions and were held out of practice.
    const causatives = typedVerbEntries.flatMap(([verb, data]) =>
      GRADABLE_FORMS.flatMap((form) => {
        const formData = getVerbFormData(data, form);
        if (formData.availability === 'absent') return [];
        const sourceVerb = formData.patternSource ?? verb;
        return inferKeigoPattern(
          formData.form,
          sourceVerb,
          data.teineigo.availability === 'present'
            ? data.teineigo.form
            : undefined,
        ) === 'sase_te_itadaku'
          ? [{ verb, form, formData }]
          : [];
      })
    );

    expect(causatives).toHaveLength(10);
    for (const { verb, form, formData } of causatives) {
      expect({ verb, form, pattern: formData.pattern })
        .toEqual({ verb, form, pattern: 'sase_te_itadaku' });
      expect({ verb, conditional: formData.conditions !== undefined })
        .toEqual({ verb, conditional: true });
      expect({ verb, reviewed: formData.review?.status })
        .toEqual({ verb, reviewed: 'reviewed' });
      // Askable with a label, never askable without one.
      expect({ verb, askable: isAskableVerbForm(verb, (verbs as unknown as Record<string, VerbData>)[verb], form) })
        .toEqual({ verb, askable: true });
      expect({ verb, gradable: isGradableVerbForm(verb, (verbs as unknown as Record<string, VerbData>)[verb], form) })
        .toEqual({ verb, gradable: false });
    }
  });

  test('derives When granted for a conditional canonical form and nothing else', () => {
    const data = verbs as unknown as Record<string, VerbData>;
    for (const [verb, entry] of typedVerbEntries) {
      for (const form of GRADABLE_FORMS) {
        const formData = getVerbFormData(entry, form);
        if (formData.availability === 'absent') continue;
        const expected = formData.conditions === undefined
          ? undefined
          : 'when_granted';
        expect({ verb, form, register: getCanonicalRegister(data[verb], form) })
          .toEqual({ verb, form, register: expected });
      }
    }
  });

  test('keeps an unconditional alternative askable on a conditional canonical slot', () => {
    const source = (verbs as unknown as Record<string, VerbData>)['使う'];
    const alternative = {
      form: '使用いたす',
      reading: 'しよういたす',
      register: 'more_formal' as const,
    };
    const conditionalWithAlternative: VerbData = {
      ...source,
      kenjougo: {
        availability: 'present',
        form: '使わせていただく',
        reading: 'つかわせていただく',
        pattern: 'sase_te_itadaku',
        conditions: ['Use only with permission and benefit.'],
        alternatives: [alternative],
      },
    };

    expect(isGradableVerbForm(
      '使う',
      conditionalWithAlternative,
      'kenjougo',
    )).toBe(false);
    expect(getGradableAlternatives(
      '使う',
      conditionalWithAlternative,
      'kenjougo',
    )).toEqual([alternative]);
  });

  test('records the register split the practice deck is built from', () => {
    const split = {
      less_formal: 0,
      more_formal: 0,
      when_granted: 0,
      contextual: 0,
    };
    for (const { alternatives } of alternativeSlots) {
      for (const alternative of alternatives) split[alternative.register] += 1;
    }
    expect(split).toEqual({
      less_formal: 92,
      more_formal: 47,
      when_granted: 9,
      contextual: 2,
    });
  });

  test('derives every newly authored passive form and reading by conjugation', () => {
    const data = verbs as unknown as Record<string, VerbData>;
    for (const [verb, verbClass] of NEW_PASSIVE_ALTERNATIVES) {
      const formData = getVerbFormData(data[verb], 'sonkeigo');
      expect(formData.availability).toBe('present');
      const alternative = formData.availability === 'present'
        ? formData.alternatives?.find((item) => item.register === 'less_formal')
        : undefined;
      expect({
        verb,
        form: alternative?.form,
        reading: alternative?.reading,
      }).toEqual({
        verb,
        form: derivePassive(verb, verbClass),
        reading: derivePassive(data[verb].reading, verbClass),
      });
    }
  });

  test('records why every misleading passive alternative is withheld', () => {
    const withheld = {
      'もらう': 'もらわれる would be read outside the intended honorific use; the canonical form uses a different lexical stem.',
      'あげる': 'あげられる would be read outside the intended honorific use; the canonical form uses a different lexical stem.',
      '届く': '届かれる would misleadingly honor an inanimate subject in the target sense.',
      'わかる': 'わかられる is not accepted as the standard honorific for this slot; use おわかりになる.',
      'いる': 'いられる is the potential of いる, not its standard honorific; use いらっしゃる.',
      '死ぬ': '死なれる is an adversative passive, not an honorific alternative.',
      'くれる': 'くれられる has no standard honorific reading; use くださる.',
      '願う': '願われる is dominated by its spontaneous reading in isolation.',
      '迷惑をかける': '迷惑をかけられる is ordinarily adversative passive and reverses the participant roles.',
    } as const;
    const data = verbs as unknown as Record<string, VerbData>;
    for (const [verb, reason] of Object.entries(withheld)) {
      const formData = getVerbFormData(data[verb], 'sonkeigo');
      expect(reason.trim()).not.toBe('');
      expect(reason).not.toContain('\n');
      expect(formData.availability).toBe('present');
      const registers = formData.availability === 'present'
        ? (formData.alternatives ?? []).map((alternative) => alternative.register)
        : [];
      expect({ verb, registers }).toEqual({
        verb,
        registers: expect.not.arrayContaining(['less_formal']),
      });
    }
  });

  test('leaves the canonical practice pool untouched by the alternatives', () => {
    // The quiz reads getGradableVerbPairs, which must keep answering with
    // unlabelled canonical forms only — it is multiple-choice with no way to
    // state a register, so alternatives and conditional forms stay out.
    const pairs = getGradableVerbPairs(typedVerbEntries, GRADABLE_FORMS);
    expect(pairs).toHaveLength(191);
    for (const pair of pairs) {
      const alternatives = pair.formData.alternatives ?? [];
      expect(alternatives.map((a) => a.form)).not.toContain(pair.formData.form);
    }
  });

  test('adds one askable card per unconditional alternative', () => {
    const askable = typedVerbEntries.flatMap(([verb, data]) =>
      GRADABLE_FORMS.flatMap((form) => getGradableAlternatives(verb, data, form))
    );
    expect(askable).toHaveLength(139);
    // The deck is askable canonical faces plus askable alternatives — NOT the
    // gradable pool, which excludes the ten When granted canonical cards.
    const canonicalFaces = typedVerbEntries.flatMap(([verb, data]) =>
      GRADABLE_FORMS.filter((form) => isAskableVerbForm(verb, data, form))
    );
    expect(canonicalFaces).toHaveLength(201);
    expect(canonicalFaces.length + askable.length).toBe(340);
    expect(askable.every((alternative) =>
      alternative.conditions === undefined && alternative.register !== 'contextual'
    )).toBe(true);
  });
});

describe('Content integrity', () => {
  test('locks the adjudicated verb content', () => {
    expect(getContentDigest(verbs)).toEqual({
      // 2834 + 3×9 ordinary adjudication fields + 1×10 for 寝る, whose
      // explicit patternSource records that its stored form conjugates 休む.
      count: 2871,
      digest: 'd278cfbbded56246a7c397bb24338628c9dc62269d37e2582dcd06d64cccff17',
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
