import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';

const VALID_LEVELS = ['basic', 'intermediate', 'advanced'];
const VALID_PATTERNS = ['special', 'o_ni_naru', 'o_suru', 'go_ni_naru', 'go_suru'];
const VALID_EXAMPLE_TYPES = ['sonkeigo', 'kenjougo', 'teineigo'];
const VALID_CATEGORIES = ['greeting', 'opening', 'closing', 'apology', 'response', 'request', 'farewell', 'gift'];

// Hiragana Unicode range: \u3040-\u309F
const HIRAGANA_REGEX = /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3000-\u303Fー、。・「」a-zA-Z\s\d.,!?()（）]+$/;

type VerbEntry = {
  reading: string;
  translation: string;
  level: string;
  sonkeigo: { form: string; reading: string; pattern?: string };
  kenjougo: { form: string; reading: string; pattern?: string };
  teineigo: { form: string; reading: string };
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
      expect(VALID_LEVELS).toContain(verb.level);
    });

    test('sonkeigo has form, reading, and pattern fields', () => {
      expect(verb.sonkeigo).toHaveProperty('form');
      expect(verb.sonkeigo).toHaveProperty('reading');
      expect(verb.sonkeigo).toHaveProperty('pattern');
    });

    test('kenjougo has form, reading, and pattern fields', () => {
      expect(verb.kenjougo).toHaveProperty('form');
      expect(verb.kenjougo).toHaveProperty('reading');
      expect(verb.kenjougo).toHaveProperty('pattern');
    });

    test('teineigo has form and reading fields', () => {
      expect(verb.teineigo).toHaveProperty('form');
      expect(verb.teineigo).toHaveProperty('reading');
    });

    test('sonkeigo pattern is valid', () => {
      expect(VALID_PATTERNS).toContain(verb.sonkeigo.pattern);
    });

    test('kenjougo pattern is valid', () => {
      expect(VALID_PATTERNS).toContain(verb.kenjougo.pattern);
    });

    test('examples is a non-empty array', () => {
      expect(Array.isArray(verb.examples)).toBe(true);
      expect(verb.examples.length).toBeGreaterThan(0);
    });

    test('each example has context, ja, en, type fields', () => {
      verb.examples.forEach((example, i) => {
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

    test('no empty string values for required fields', () => {
      expect(verbKey.trim()).not.toBe('');
      expect(verb.reading.trim()).not.toBe('');
      expect(verb.translation.trim()).not.toBe('');
      expect(verb.level.trim()).not.toBe('');
      expect(verb.sonkeigo.form.trim()).not.toBe('');
      expect(verb.sonkeigo.reading.trim()).not.toBe('');
      expect(verb.sonkeigo.pattern!.trim()).not.toBe('');
      expect(verb.kenjougo.form.trim()).not.toBe('');
      expect(verb.kenjougo.reading.trim()).not.toBe('');
      expect(verb.kenjougo.pattern!.trim()).not.toBe('');
      expect(verb.teineigo.form.trim()).not.toBe('');
      expect(verb.teineigo.reading.trim()).not.toBe('');
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
      // Verb reading should be primarily hiragana
      const hiraganaOnly = /^[\u3040-\u309Fー]+$/;
      expect(verb.reading).toMatch(hiraganaOnly);
    });
  });
});

describe('Expression data validation', () => {
  test('expressions.json is not empty', () => {
    expect(expressionEntries.length).toBeGreaterThan(0);
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
      expect(VALID_LEVELS).toContain(expr.level);
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
