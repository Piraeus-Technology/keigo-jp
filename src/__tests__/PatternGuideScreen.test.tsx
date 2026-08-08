import React from 'react';
import { StyleSheet } from 'react-native';
import { render, within } from '@testing-library/react-native';
import verbs from '../data/verbs.json';
import PatternGuideScreen, {
  PatternGuideContent,
} from '../screens/PatternGuideScreen';
import {
  KEIGO_REGISTER_LABELS,
  type VerbData,
} from '../utils/keigoTypes';

jest.mock('../utils/speech', () => ({
  speak: jest.fn(),
}));

describe('PatternGuideScreen', () => {
  test('documents every register label a learner can be shown', () => {
    // The drift guard: a register added to the whitelist without being taught
    // here fails this test, because a learner would otherwise meet a label —
    // on a prompt or on a detail page — that nothing explains. It caught
    // 'Context-dependent' the first time it ran.
    const view = render(<PatternGuideScreen />);
    const registerKey = within(view.getByTestId('register-key-card'));
    const labels = Object.values(KEIGO_REGISTER_LABELS);

    expect(labels).toHaveLength(4);
    for (const label of labels) {
      expect(registerKey.getByText(label)).toBeTruthy();
    }
  });

  test('explains canonical cards and gives the empty badge a visible outline', () => {
    const view = render(<PatternGuideScreen />);
    const canonicalRow = within(view.getByTestId('register-row-canonical'));
    const noLabelBadge = canonicalRow.getByText('No label');
    const noLabelStyle = StyleSheet.flatten(noLabelBadge.props.style);

    expect(view.getByText('What card and detail labels mean')).toBeTruthy();
    expect(view.getByText(/A card with no label asks for the canonical form/))
      .toBeTruthy();
    expect(canonicalRow.getByText(/bare …いたす for a サ変 verb/)).toBeTruthy();
    expect(canonicalRow.getByText(
      'Dictionary → unlabelled answer: 読む → お読みになる',
    )).toBeTruthy();
    expect(noLabelStyle.borderColor).toBe(noLabelStyle.color);
  });

  test('demonstrates いたす under its own formula, not under ご〜する', () => {
    const view = render(<PatternGuideScreen />);
    const itasuCard = within(view.getByTestId('kenjougo-itasu-card'));

    // ご案内いたします used to sit beside 後ほどご連絡します as though it
    // demonstrated ご + noun + する, which it does not.
    expect(view.getByText('ご案内します')).toBeTruthy();
    expect(itasuCard.getByText(
      'お + verb stem + いたす　/　ご + Sino-Japanese noun + いたす',
    )).toBeTruthy();
    expect(itasuCard.getByText('ご案内いたします')).toBeTruthy();
    expect(itasuCard.getByText('お待ちいたします')).toBeTruthy();
    expect(itasuCard.getByText('お書きいたします')).toBeTruthy();
    expect(itasuCard.queryByText('確認いたします')).toBeNull();
  });

  test('states card availability for every register from current practice data', () => {
    const view = render(<PatternGuideScreen />);

    for (const register of ['less_formal', 'more_formal'] as const) {
      expect(within(view.getByTestId(`register-row-${register}`)).getByText(
        'Asked on flashcards and shown on detail pages.',
      )).toBeTruthy();
    }
    for (const register of ['when_granted', 'contextual'] as const) {
      expect(within(view.getByTestId(`register-row-${register}`)).getByText(
        'Shown on detail pages; not currently asked on flashcards.',
      )).toBeTruthy();
    }
    expect(view.getByText(
      `Pattern 4 — flashcards call this “${KEIGO_REGISTER_LABELS.less_formal}”`,
    )).toBeTruthy();
    expect(view.getByText(
      `More formal variant — flashcards call this “${KEIGO_REGISTER_LABELS.more_formal}”`,
    )).toBeTruthy();
    expect(view.getByText(
      `Pattern 4 — detail pages call this “${KEIGO_REGISTER_LABELS.when_granted}”; not currently asked on flashcards`,
    )).toBeTruthy();
  });

  test('changes the guide claim when a register becomes askable', () => {
    const scratch = JSON.parse(JSON.stringify(verbs)) as Record<string, VerbData>;
    const humble = scratch['利用する'].kenjougo;
    if (humble.availability !== 'present' || !humble.alternatives) {
      throw new Error('Expected 利用する to have a humble alternative');
    }
    const whenGranted = humble.alternatives.find(
      (alternative) => alternative.register === 'when_granted',
    );
    if (!whenGranted) throw new Error('Expected a when_granted alternative');
    delete whenGranted.conditions;

    const view = render(
      <PatternGuideContent verbEntries={Object.entries(scratch)} />,
    );

    expect(within(view.getByTestId('register-row-when_granted')).getByText(
      'Asked on flashcards and shown on detail pages.',
    )).toBeTruthy();
    expect(view.getByText(
      `Pattern 4 — flashcards call this “${KEIGO_REGISTER_LABELS.when_granted}”`,
    )).toBeTruthy();
  });

  test('makes the left-hand side of each register example explicit', () => {
    const view = render(<PatternGuideScreen />);
    const examples = [
      ['canonical', 'Dictionary → unlabelled answer: 読む → お読みになる'],
      ['less_formal', 'Dictionary → labelled answer: 読む → 読まれる'],
      ['more_formal', 'Canonical → labelled answer: お書きする → お書きいたす'],
      ['when_granted', 'Dictionary → conditional alternative: 利用する → 利用させていただく'],
      ['contextual', 'Canonical / contextual alternative: 申す / 申し上げる'],
    ] as const;

    for (const [register, example] of examples) {
      expect(within(view.getByTestId(`register-row-${register}`)).getByText(example))
        .toBeTruthy();
    }
  });
});
