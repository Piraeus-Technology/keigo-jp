import type {
  KeigoAlternative,
  KeigoForm,
  KeigoFormData,
  KeigoRegister,
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

/**
 * Can this form be asked at all, given a way to state the register it needs?
 * A condition-dependent form qualifies here but not in `isGradableVerbForm`,
 * because a prompt that names the register supplies the context a bare prompt
 * cannot.
 */
export function isAskableVerbForm(
  verb: string,
  data: VerbData,
  form: KeigoForm,
): boolean {
  if (!hasCanonicalVerbForm(data, form)) return false;
  const formData = getVerbFormData(data, form);
  return formData.availability === 'present'
    && formData.review?.status !== 'needs_review'
    && formData.form.trim() !== verb.trim();
}

/**
 * Can this form be asked with NO label at all? Strictly narrower than
 * `isAskableVerbForm`. The quiz is multiple-choice with no way to state a
 * register, so it must keep using this one.
 */
export function isGradableVerbForm(
  verb: string,
  data: VerbData,
  form: KeigoForm,
): boolean {
  if (!isAskableVerbForm(verb, data, form)) return false;
  const formData = getVerbFormData(data, form);
  return formData.conditions === undefined;
}

/**
 * The register a canonical form's own card must announce. Conditions mean
 * permission-and-benefit, the same thing `when_granted` marks on an
 * alternative; an unconditional canonical form is the unlabelled default.
 */
export function getCanonicalRegister(
  data: VerbData,
  form: KeigoForm,
): KeigoRegister | undefined {
  const formData = getVerbFormData(data, form);
  return formData.conditions === undefined ? undefined : 'when_granted';
}

export function getAskableForms(
  verb: string,
  data: VerbData,
  activeForms: KeigoForm[],
): KeigoForm[] {
  return activeForms.filter((form) => isAskableVerbForm(verb, data, form));
}

export function getGradableForms(
  verb: string,
  data: VerbData,
  activeForms: KeigoForm[],
): KeigoForm[] {
  return activeForms.filter((form) => isGradableVerbForm(verb, data, form));
}

/**
 * An alternative can be asked for on its own card only when it holds
 * unconditionally — the same bar `isGradableVerbForm` applies to a canonical
 * form. A permission-and-benefit form like 利用させていただく depends on context
 * the prompt cannot supply, so it stays Detail-only.
 */
export function isGradableAlternative(alternative: KeigoAlternative): boolean {
  return alternative.conditions === undefined
    && alternative.register !== 'contextual';
}

export function getGradableAlternatives(
  verb: string,
  data: VerbData,
  form: KeigoForm,
): KeigoAlternative[] {
  // Gated on askable, not gradable: whether the slot's own canonical form needs
  // a register says nothing about its alternatives, whose eligibility is
  // decided one by one below.
  if (!isAskableVerbForm(verb, data, form)) return [];
  const formData = getVerbFormData(data, form);
  if (formData.availability === 'absent') return [];
  return (formData.alternatives ?? []).filter(isGradableAlternative);
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
