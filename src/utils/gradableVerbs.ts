import type { KeigoForm, KeigoFormData, VerbData } from './keigoTypes';

export interface GradableVerbPair {
  verb: string;
  data: VerbData;
  form: KeigoForm;
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
  return getVerbFormData(data, form).form.trim().length > 0;
}

export function isGradableVerbForm(
  verb: string,
  data: VerbData,
  form: KeigoForm,
): boolean {
  const answer = getVerbFormData(data, form).form.trim();
  return hasCanonicalVerbForm(data, form) && answer !== verb.trim();
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
    getGradableForms(verb, data, activeForms).map((form) => ({
      verb,
      data,
      form,
    })),
  );
}
