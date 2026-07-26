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
] as const;

export type KeigoPattern = typeof KEIGO_PATTERNS[number];

export const HUMBLE_SUBCLASSES = ['kenjougo_i', 'kenjougo_ii'] as const;
export type HumbleSubclass = typeof HUMBLE_SUBCLASSES[number];

export const REVIEW_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ReviewConfidence = typeof REVIEW_CONFIDENCE_LEVELS[number];

export interface KeigoAlternative {
  form: string;
  reading: string;
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
  'ご覧になる',
  'おかけになる',
  'お休みになる',
  'お召しになる',
  'お亡くなりになる',
]);

export function inferKeigoPattern(form: string): KeigoPattern {
  if (/させていただく$/.test(form)) return 'sase_te_itadaku';
  if (LEXICALIZED_SPECIAL_FORMS.has(form)) return 'special';
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
): boolean {
  return inferKeigoPattern(form) === pattern;
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
    && (value.conditions === undefined
      || isNonEmptyStringArray(value.conditions));
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
): value is KeigoFormData {
  if (!isRecord(value)) return false;
  if (value.note !== undefined && !isNonEmptyString(value.note)) return false;
  if (value.humbleSubclass !== undefined
    && !(HUMBLE_SUBCLASSES as readonly unknown[])
      .includes(value.humbleSubclass)) {
    return false;
  }
  if (value.conditions !== undefined
    && !isNonEmptyStringArray(value.conditions)) {
    return false;
  }
  if (value.alternatives !== undefined
    && (!Array.isArray(value.alternatives)
      || value.alternatives.length === 0
      || !value.alternatives.every(isValidAlternative))) {
    return false;
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
      && isKeigoPatternConsistent(value.form, value.pattern));
}
