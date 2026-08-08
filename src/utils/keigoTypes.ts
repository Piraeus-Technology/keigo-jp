export type KeigoForm = 'sonkeigo' | 'kenjougo' | 'teineigo';
export type BusinessLevel = 'basic' | 'intermediate' | 'advanced';
export type ExpressionCategory = 'greeting' | 'opening' | 'closing' | 'apology' | 'response' | 'request' | 'farewell' | 'gift';

export const KEIGO_PATTERNS = [
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
] as const;

export type KeigoPattern = typeof KEIGO_PATTERNS[number];

export const HUMBLE_SUBCLASSES = ['kenjougo_i', 'kenjougo_ii'] as const;
export type HumbleSubclass = typeof HUMBLE_SUBCLASSES[number];

// How an alternative form's register sits relative to the canonical form of the
// same slot. This is relative, not absolute: いたす is the plain canonical humble
// for 利用する, but お書きいたす is a step above お書きする for 書く — so the
// register belongs on the alternative, not on the pattern.
export const KEIGO_REGISTERS = [
  'less_formal',
  'more_formal',
  'when_granted',
  'contextual',
] as const;
export type KeigoRegister = typeof KEIGO_REGISTERS[number];

// Shown on the prompt side so the learner knows which register is wanted. An
// unlabelled card asks for the canonical form. The wording deliberately names
// the register and not the pattern — 'Less formal' must not give away れる/られる.
export const KEIGO_REGISTER_LABELS: Record<KeigoRegister, string> = {
  less_formal: 'Less formal',
  more_formal: 'More formal',
  when_granted: 'When granted',
  contextual: 'Context-dependent',
};

export const REVIEW_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ReviewConfidence = typeof REVIEW_CONFIDENCE_LEVELS[number];

export interface KeigoAlternative {
  form: string;
  reading: string;
  register: KeigoRegister;
  conditions?: string[];
}

export interface KeigoReviewCitation {
  source: string;
  locator?: string;
  url?: string;
}

export type KeigoReviewState =
  | {
    status: 'needs_review';
  }
  | {
    status: 'reviewed';
    rationale: string;
    citations: [KeigoReviewCitation, ...KeigoReviewCitation[]];
    confidence: ReviewConfidence;
  };

interface KeigoFormMetadata {
  note?: string;
  /** Dictionary form that supplies the conjugation when it differs from the
   * card's headword, such as 休む for the 寝る card. */
  patternSource?: string;
  humbleSubclass?: HumbleSubclass;
  conditions?: string[];
  alternatives?: KeigoAlternative[];
  review?: KeigoReviewState;
}

export interface PresentKeigoFormData extends KeigoFormMetadata {
  availability: 'present';
  form: string;
  reading: string;
  pattern?: KeigoPattern;
}

export interface AbsentKeigoFormData extends KeigoFormMetadata {
  availability: 'absent';
  note: string;
}

export type KeigoFormData = PresentKeigoFormData | AbsentKeigoFormData;

export interface VerbExample {
  context: string;
  ja: string;
  en: string;
  type: KeigoForm;
}

export interface VerbData {
  reading: string;
  translation: string;
  /** Direction-neutral gloss for English-mode flashcard prompts. Falls back to
   * `translation`, which may encode the answer's own register. */
  promptGloss?: string;
  level: BusinessLevel;
  sonkeigo: KeigoFormData;
  kenjougo: KeigoFormData;
  teineigo: KeigoFormData;
  examples: VerbExample[];
}

export interface ExpressionExample {
  ja: string;
  en: string;
}

export interface ExpressionData {
  reading: string;
  translation: string;
  level: BusinessLevel;
  category: ExpressionCategory;
  usage: string;
  examples: ExpressionExample[];
}

export const KEIGO_FORM_LABELS: Record<KeigoForm, { ja: string; en: string }> = {
  sonkeigo: { ja: '尊敬語', en: 'Respectful' },
  kenjougo: { ja: '謙譲語', en: 'Humble' },
  teineigo: { ja: '丁寧語', en: 'Polite' },
};

export const LEVEL_LABELS: Record<BusinessLevel, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

// Which language a flashcard's prompt side is written in. Expression cards
// only exist in the English direction — their Japanese headword is the answer —
// so 'japanese' drills verbs alone.
export const PROMPT_LANGUAGES = ['japanese', 'english', 'both'] as const;

export type PromptLanguage = typeof PROMPT_LANGUAGES[number];

export const PROMPT_LANGUAGE_LABELS: Record<PromptLanguage, { title: string; detail: string }> = {
  japanese: {
    title: 'Japanese',
    detail: 'Verb cards only, shown without their English meaning.',
  },
  english: {
    title: 'English',
    detail: 'Every card asks for the keigo of an English meaning.',
  },
  both: {
    title: 'Both',
    detail: 'Mixes Japanese verb prompts with English expression prompts.',
  },
};

export const CATEGORY_LABELS: Record<ExpressionCategory, { ja: string; en: string }> = {
  greeting: { ja: '挨拶', en: 'Greeting' },
  opening: { ja: '前置き', en: 'Opening' },
  closing: { ja: '締め', en: 'Closing' },
  apology: { ja: '謝罪', en: 'Apology' },
  response: { ja: '返答', en: 'Response' },
  request: { ja: '依頼', en: 'Request' },
  farewell: { ja: '退出', en: 'Farewell' },
  gift: { ja: '贈り物', en: 'Gift-giving' },
};

export const ALL_FORMS: KeigoForm[] = ['sonkeigo', 'kenjougo', 'teineigo'];
export const GRADABLE_FORMS: KeigoForm[] = ['sonkeigo', 'kenjougo'];
export const ALL_LEVELS: BusinessLevel[] = ['basic', 'intermediate', 'advanced'];

const LEXICALIZED_SPECIAL_FORMS = new Set([
  'なさる',
  'いたす',
  'ご覧になる',
  'おかけになる',
  'お休みになる',
  'お召しになる',
  'お亡くなりになる',
]);

const GODAN_CAUSATIVE_STEMS: Record<string, string> = {
  'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ', 'つ': 'た',
  'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま',
};

/**
 * Derive the complete permission-and-benefit form from its source verb.
 * Surface spelling is insufficient: 聞かせて is the causative of 聞く, while the
 * same suffix in 合わせて belongs to the lexical verb 合わせる. For a 〜る verb,
 * its existing polite form supplies the otherwise ambiguous conjugation class.
 */
function deriveCausativeTeItadaku(
  sourceVerb: string,
  politeForm?: string,
): string | undefined {
  if (sourceVerb.endsWith('する')) {
    return `${sourceVerb.slice(0, -2)}させていただく`;
  }
  if (sourceVerb === '来る') return '来させていただく';
  if (sourceVerb === 'くる') return 'こさせていただく';

  const ending = sourceVerb.at(-1) ?? '';
  const stem = sourceVerb.slice(0, -1);
  if (ending === 'る') {
    if (politeForm === `${stem}ます`) {
      return `${stem}させていただく`;
    }
    if (politeForm === `${stem}ります`) {
      return `${stem}らせていただく`;
    }
    // Without conjugation-class evidence, fail closed instead of guessing.
    return undefined;
  }

  const causativeEnding = GODAN_CAUSATIVE_STEMS[ending];
  return causativeEnding
    ? `${stem}${causativeEnding}せていただく`
    : undefined;
}

export function inferKeigoPattern(
  form: string,
  sourceVerb: string,
  politeForm?: string,
): KeigoPattern {
  if (LEXICALIZED_SPECIAL_FORMS.has(form)) return 'special';
  if (form.endsWith('せていただく')) {
    return deriveCausativeTeItadaku(sourceVerb, politeForm) === form
      ? 'sase_te_itadaku'
      : 'special';
  }
  if (/^お.+いたす$/.test(form)) return 'o_itasu';
  if (/^ご.+いたす$/.test(form)) return 'go_itasu';
  if (/いたす$/.test(form)) return 'itasu';
  if (/なさる$/.test(form)) return 'nasaru';
  if (/^お.+になる$/.test(form)) return 'o_ni_naru';
  if (/^ご.+になる$/.test(form)) return 'go_ni_naru';
  if (/^お.+する$/.test(form)) return 'o_suru';
  if (/^ご.+する$/.test(form)) return 'go_suru';
  return 'special';
}

export function isKeigoPattern(value: unknown): value is KeigoPattern {
  return typeof value === 'string'
    && (KEIGO_PATTERNS as readonly string[]).includes(value);
}

export function isKeigoPatternConsistent(
  form: string,
  pattern: KeigoPattern,
  sourceVerb: string,
  politeForm?: string,
): boolean {
  return inferKeigoPattern(form, sourceVerb, politeForm) === pattern;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every(isNonEmptyString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidAlternative(value: unknown): value is KeigoAlternative {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.form)
    && isNonEmptyString(value.reading)
    && typeof value.register === 'string'
    && (KEIGO_REGISTERS as readonly string[]).includes(value.register)
    && (value.conditions === undefined
      || isNonEmptyStringArray(value.conditions));
}

function hasUniqueAlternativeRegisters(
  alternatives: KeigoAlternative[],
): boolean {
  const registers = alternatives.map((alternative) => alternative.register);
  return new Set(registers).size === registers.length;
}

function isValidCitation(value: unknown): value is KeigoReviewCitation {
  if (!isRecord(value) || !isNonEmptyString(value.source)) return false;
  return (value.locator === undefined || isNonEmptyString(value.locator))
    && (value.url === undefined || isNonEmptyString(value.url));
}

function isValidReviewState(value: unknown): value is KeigoReviewState {
  if (!isRecord(value)) return false;
  if (value.status === 'needs_review') {
    return value.rationale === undefined
      && value.citations === undefined
      && value.confidence === undefined;
  }
  if (value.status !== 'reviewed') return false;
  return isNonEmptyString(value.rationale)
    && Array.isArray(value.citations)
    && value.citations.length > 0
    && value.citations.every(isValidCitation)
    && typeof value.confidence === 'string'
    && (REVIEW_CONFIDENCE_LEVELS as readonly string[])
      .includes(value.confidence);
}

export function isValidKeigoFormData(
  value: unknown,
  sourceVerb?: string,
  politeForm?: string,
): value is KeigoFormData {
  if (!isRecord(value)) return false;
  if (value.note !== undefined && !isNonEmptyString(value.note)) return false;
  if (value.patternSource !== undefined
    && !isNonEmptyString(value.patternSource)) return false;
  if (value.humbleSubclass !== undefined
    && !(HUMBLE_SUBCLASSES as readonly unknown[])
      .includes(value.humbleSubclass)) {
    return false;
  }
  if (value.conditions !== undefined
    && !isNonEmptyStringArray(value.conditions)) {
    return false;
  }
  if (value.alternatives !== undefined) {
    if (!Array.isArray(value.alternatives)
      || value.alternatives.length === 0
      || !value.alternatives.every(isValidAlternative)
      || !hasUniqueAlternativeRegisters(value.alternatives)) {
      return false;
    }
  }
  if (value.review !== undefined && !isValidReviewState(value.review)) {
    return false;
  }

  if (value.availability === 'absent') {
    return isNonEmptyString(value.note)
      && !('form' in value)
      && !('reading' in value)
      && !('pattern' in value);
  }
  if (value.availability !== 'present'
    || !isNonEmptyString(value.form)
    || !isNonEmptyString(value.reading)) {
    return false;
  }
  return value.pattern === undefined
    || (isKeigoPattern(value.pattern)
      && isKeigoPatternConsistent(
        value.form,
        value.pattern,
        isNonEmptyString(value.patternSource)
          ? value.patternSource
          : sourceVerb ?? '',
        politeForm,
      ));
}
