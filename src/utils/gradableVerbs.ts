import type {
  KeigoForm,
  KeigoFormData,
  PresentKeigoFormData,
  VerbData,
} from './keigoTypes';

export interface GradableVerbPair {
  verb: string;
  data: VerbData;
  form: KeigoForm;
  formData: PresentKeigoFormData;
}

export function getVerbFormData(
  data: VerbData,
  form: KeigoForm,
): KeigoFormData {
  return data[form];
}

export function hasCanonicalVerbForm(
  data: VerbData,
  form: KeigoForm,
): boolean {
  return getVerbFormData(data, form).availability === 'present';
}

export function isGradableVerbForm(
  verb: string,
  data: VerbData,
  form: KeigoForm,
): boolean {
  if (!hasCanonicalVerbForm(data, form)) return false;
  const formData = getVerbFormData(data, form);
  return formData.availability === 'present'
    && formData.review?.status !== 'needs_review'
    && formData.conditions === undefined
    && formData.form.trim() !== verb.trim();
}

export function getGradableForms(
  verb: string,
  data: VerbData,
  activeForms: KeigoForm[],
): KeigoForm[] {
  return activeForms.filter((form) => isGradableVerbForm(verb, data, form));
}

export function getGradableVerbPairs(
  entries: [string, VerbData][],
  activeForms: KeigoForm[],
): GradableVerbPair[] {
  return entries.flatMap(([verb, data]) =>
    getGradableForms(verb, data, activeForms).flatMap((form) => {
      const formData = getVerbFormData(data, form);
      if (formData.availability === 'absent') return [];
      return [{
        verb,
        data,
        form,
        formData,
      }];
    }),
  );
}
