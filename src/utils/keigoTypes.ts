export type KeigoForm = 'sonkeigo' | 'kenjougo' | 'teineigo';
export type BusinessLevel = 'basic' | 'intermediate' | 'advanced';
export type ExpressionCategory = 'greeting' | 'opening' | 'closing' | 'apology' | 'response' | 'request' | 'farewell' | 'gift';

export interface KeigoFormData {
  form: string;
  reading: string;
  pattern?: string;
  note?: string;
}

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
  teineigo: { form: string; reading: string };
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
export const ALL_LEVELS: BusinessLevel[] = ['basic', 'intermediate', 'advanced'];
