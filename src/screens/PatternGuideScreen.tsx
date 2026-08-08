import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import type { ThemeColors } from '../utils/theme';
import {
  GRADABLE_FORMS,
  KEIGO_REGISTER_LABELS,
  type KeigoRegister,
  type VerbData,
} from '../utils/keigoTypes';
import { getGradableAlternatives } from '../utils/gradableVerbs';
import { speak } from '../utils/speech';

/* ─── data ─── */

interface Example {
  ja: string;
  en: string;
}

interface SpecialVerb {
  plain: string;
  keigo: string;
  meaning: string;
}

interface PatternInfo {
  formula: string;
  examples: Example[];
}

interface TableSection {
  title: string;
  verbs: SpecialVerb[];
}

interface MistakeInfo {
  wrong: string;
  right: string;
  explanation: string;
}

const SONKEIGO_PATTERNS: PatternInfo[] = [
  {
    formula: 'お + verb stem + になる',
    examples: [
      { ja: '先生がお読みになる', en: 'The teacher reads (respectful)' },
      { ja: '社長がお帰りになる', en: 'The president leaves (respectful)' },
    ],
  },
  {
    formula: 'ご + Sino-Japanese noun + になる',
    examples: [
      { ja: 'お客様がご確認になる', en: 'The customer confirms (respectful)' },
      { ja: '先生がご説明になる', en: 'The teacher explains (respectful)' },
    ],
  },
];

const SONKEIGO_SPECIAL: TableSection = {
  title: 'Special Respectful Verbs',
  verbs: [
    { plain: 'いる / 行く / 来る', keigo: 'いらっしゃる', meaning: 'to be / go / come' },
    { plain: '言う', keigo: 'おっしゃる', meaning: 'to say' },
    { plain: '食べる / 飲む', keigo: '召し上がる', meaning: 'to eat / drink' },
    { plain: '見る', keigo: 'ご覧になる', meaning: 'to look / see' },
    { plain: 'くれる', keigo: 'くださる', meaning: 'to give (to me)' },
    { plain: '知っている', keigo: 'ご存じだ', meaning: 'to know' },
  ],
};

const SONKEIGO_PASSIVE: PatternInfo = {
  formula: 'verb stem + れる / られる (passive form)',
  examples: [
    { ja: '部長が話される', en: 'The director speaks (mildly respectful)' },
    { ja: '先生が来られる', en: 'The teacher comes (mildly respectful)' },
    { ja: '社長が読まれる', en: 'The president reads (mildly respectful)' },
  ],
};

const KENJOUGO_PATTERNS: PatternInfo[] = [
  {
    formula: 'お + verb stem + する',
    examples: [
      { ja: '荷物をお持ちします', en: 'I will carry (your) luggage (humble)' },
      { ja: 'お待ちしております', en: 'I am waiting (humble, polite)' },
    ],
  },
  {
    formula: 'ご + Sino-Japanese noun + する',
    examples: [
      { ja: '後ほどご連絡します', en: 'I will contact you later (humble)' },
      { ja: 'ご案内します', en: 'I will guide you (humble)' },
    ],
  },
];

// Replacing する in お/ご〜する with いたす combines 謙譲語I and 謙譲語II.
// This relative variant is distinct from bare …いたす, which is the canonical
// 謙譲語II form for some サ変 verbs and therefore has no flashcard label.
const KENJOUGO_ITASU: PatternInfo = {
  formula: 'お + verb stem + いたす　/　ご + Sino-Japanese noun + いたす',
  examples: [
    { ja: 'ご案内いたします', en: 'I will guide you (humble, more formal)' },
    { ja: 'お待ちいたします', en: 'I will wait (humble, more formal)' },
    { ja: 'お書きいたします', en: 'I will write (humble, more formal)' },
  ],
};

const KENJOUGO_SPECIAL: TableSection = {
  title: 'Special Humble Verbs',
  verbs: [
    { plain: '行く / 来る', keigo: '参る', meaning: 'to go / come' },
    { plain: '言う', keigo: '申す', meaning: 'to say' },
    { plain: 'する', keigo: 'いたす', meaning: 'to do' },
    { plain: '見る', keigo: '拝見する', meaning: 'to look / see' },
    { plain: '食べる / 飲む', keigo: 'いただく', meaning: 'to eat / drink / receive' },
    { plain: 'いる', keigo: 'おる', meaning: 'to be' },
    { plain: '知っている', keigo: '存じている', meaning: 'to know' },
    { plain: 'もらう', keigo: 'いただく', meaning: 'to receive' },
  ],
};

const KENJOUGO_SASETE: PatternInfo = {
  formula: 'verb stem + させていただく',
  examples: [
    { ja: '確認させていただきます', en: 'Allow me to confirm' },
    { ja: '説明させていただきます', en: 'Allow me to explain' },
    { ja: '退席させていただきます', en: 'Allow me to excuse myself' },
  ],
};

const TEINEIGO_EXAMPLES: Example[] = [
  { ja: '本日は晴れです', en: 'It is sunny today (polite)' },
  { ja: '会議は３時に始まります', en: 'The meeting starts at 3 (polite)' },
];

const TEINEIGO_GOZAIMASU: Example[] = [
  { ja: 'おはようございます', en: 'Good morning (formal polite)' },
  { ja: 'お手洗いはあちらでございます', en: 'The restroom is over there (formal polite)' },
];

interface UpgradeRow {
  casual: string;
  polite: string;
  meaning: string;
}

const TEINEIGO_UPGRADES: UpgradeRow[] = [
  { casual: 'ある', polite: 'ございます', meaning: 'to exist / have' },
  { casual: 'いい', polite: 'よろしい', meaning: 'good / fine' },
  { casual: 'どう', polite: 'いかが', meaning: 'how' },
  { casual: 'すみません', polite: '申し訳ございません', meaning: 'I\'m sorry' },
  { casual: 'ちょっと', polite: '少々', meaning: 'a little' },
];

// What card and Detail labels mean. Labels are read from the same source the
// prompt renders, and card availability is derived through the same eligibility
// rules as the deck so this explanation cannot drift from practice behavior.
interface RegisterRow {
  register: KeigoRegister | null;
  meaning: string;
  example: string;
}

const REGISTER_ROWS: RegisterRow[] = [
  {
    register: null,
    meaning: 'The canonical answer stored for that verb — commonly a special form, Pattern 1 or 2, or bare …いたす for a サ変 verb.',
    example: 'Dictionary → unlabelled answer: 読む → お読みになる',
  },
  {
    register: 'less_formal',
    meaning: 'The 尊敬語 passive, Pattern 4. Respectful but lighter.',
    example: 'Dictionary → labelled answer: 読む → 読まれる',
  },
  {
    register: 'more_formal',
    meaning: 'A step up from a canonical お/ご〜する form, using いたす in place of する.',
    example: 'Canonical → labelled answer: お書きする → お書きいたす',
  },
  {
    register: 'when_granted',
    meaning: 'させていただく, for when you are permitted to act and benefit from it.',
    example: 'Dictionary → conditional alternative: 利用する → 利用させていただく',
  },
  {
    register: 'contextual',
    meaning: 'Which form is right depends on the situation, not on how formal you want to be.',
    example: 'Canonical / contextual alternative: 申す / 申し上げる',
  },
];

export type PatternGuideVerbEntry = [string, VerbData];

const ALL_VERB_ENTRIES = Object.entries(
  verbs as Record<string, VerbData>,
) as PatternGuideVerbEntry[];

/** Derive register availability from the same eligibility rules as the deck. */
export function getAskableRegisters(
  verbEntries: PatternGuideVerbEntry[],
): ReadonlySet<KeigoRegister> {
  return new Set(
    verbEntries.flatMap(([verb, data]) =>
      GRADABLE_FORMS.flatMap((form) =>
        getGradableAlternatives(verb, data, form).map(
          (alternative) => alternative.register,
        )
      )
    ),
  );
}

function registerAvailabilityText(
  register: KeigoRegister | null,
  askableRegisters: ReadonlySet<KeigoRegister>,
): string {
  if (register === null) return 'Asked on flashcards.';
  return askableRegisters.has(register)
    ? 'Asked on flashcards and shown on detail pages.'
    : 'Shown on detail pages; not currently asked on flashcards.';
}

function registerPatternHeading(
  prefix: string,
  register: KeigoRegister,
  askableRegisters: ReadonlySet<KeigoRegister>,
): string {
  const label = KEIGO_REGISTER_LABELS[register];
  return askableRegisters.has(register)
    ? `${prefix} — flashcards call this “${label}”`
    : `${prefix} — detail pages call this “${label}”; not currently asked on flashcards`;
}

const COMMON_MISTAKES: MistakeInfo[] = [
  {
    wrong: 'お読みになられる',
    right: 'お読みになる',
    explanation: 'Double keigo (二重敬語): combining お〜になる with 〜られる is redundant. Use one pattern only.',
  },
  {
    wrong: '私がいらっしゃる',
    right: '私が参る',
    explanation: 'Using sonkeigo for yourself: respectful forms elevate others, not yourself. Use humble forms for your own actions.',
  },
  {
    wrong: '弊社の田中部長がおっしゃいました',
    right: '弊社の田中が申しておりました',
    explanation: 'When speaking to outsiders (customers, other companies), do NOT use sonkeigo or titles for your own colleagues. Use humble forms and drop honorific titles.',
  },
];

/* ─── components ─── */

function SectionHeader({
  title,
  subtitle,
  color,
  bgColor,
}: {
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={[sty.sectionHeader, { backgroundColor: bgColor }]}>
      <Text style={[sty.sectionTitle, { color }]}>{title}</Text>
      <Text style={[sty.sectionSubtitle, { color }]}>{subtitle}</Text>
    </View>
  );
}

function FormulaBox({ formula, colors }: { formula: string; colors: ThemeColors }) {
  return (
    <View style={[sty.formulaBox, { backgroundColor: colors.pillBg }]}>
      <Text style={[sty.formulaText, { color: colors.primary }]}>{formula}</Text>
    </View>
  );
}

function ExampleRow({ example, colors }: { example: Example; colors: ThemeColors }) {
  return (
    <TouchableOpacity
      style={[sty.exampleRow, { borderBottomColor: colors.divider }]}
      onPress={() => speak(example.ja)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Play pronunciation of ${example.ja}`}
    >
      <View style={sty.exampleText}>
        <Text style={[sty.exampleJa, { color: colors.textPrimary }]}>{example.ja}</Text>
        <Text style={[sty.exampleEn, { color: colors.textSecondary }]}>{example.en}</Text>
      </View>
      <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function PatternCard({
  index,
  pattern,
  colors,
}: {
  index: number;
  pattern: PatternInfo;
  colors: ThemeColors;
}) {
  return (
    <View style={[sty.card, { backgroundColor: colors.card }]}>
      <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>Pattern {index}</Text>
      <FormulaBox formula={pattern.formula} colors={colors} />
      {pattern.examples.map((ex, i) => (
        <ExampleRow key={i} example={ex} colors={colors} />
      ))}
    </View>
  );
}

function SpecialVerbTable({
  index,
  section,
  tagText,
  colors,
}: {
  index: number;
  section: TableSection;
  tagText: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[sty.card, { backgroundColor: colors.card }]}>
      <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>
        Pattern {index}: {section.title}
      </Text>
      {/* Header row */}
      <View style={[sty.tableHeaderRow, { borderBottomColor: colors.divider }]}>
        <Text style={[sty.tableHeaderCell, { color: colors.textMuted, flex: 1.2 }]}>Plain</Text>
        <Text style={[sty.tableHeaderCell, { color: colors.textMuted, flex: 1.3 }]}>Keigo</Text>
        <Text style={[sty.tableHeaderCell, { color: colors.textMuted, flex: 1 }]}>Meaning</Text>
      </View>
      {section.verbs.map((v, i) => (
        <TouchableOpacity
          key={i}
          style={[sty.tableRow, { borderBottomColor: colors.divider }]}
          onPress={() => speak(v.keigo)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Play pronunciation of ${v.keigo}`}
        >
          <Text style={[sty.tableCell, { color: colors.textSecondary, flex: 1.2 }]}>{v.plain}</Text>
          <View style={{ flex: 1.3, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[sty.tableCellKeigo, { color: tagText }]}>{v.keigo}</Text>
            <Ionicons name="volume-medium-outline" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
          </View>
          <Text style={[sty.tableCell, { color: colors.textMuted, flex: 1, fontSize: fonts.sizes.xs }]}>{v.meaning}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MistakeCard({ mistake, colors }: { mistake: MistakeInfo; colors: ThemeColors }) {
  return (
    <View style={[sty.card, { backgroundColor: colors.card }]}>
      <View style={sty.mistakeRow}>
        <Ionicons name="close-circle" size={18} color={colors.errorText} />
        <Text style={[sty.mistakeWrong, { color: colors.errorText }]}>  {mistake.wrong}</Text>
      </View>
      <View style={[sty.mistakeRow, { marginTop: spacing.xs }]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.successText} />
        <Text style={[sty.mistakeRight, { color: colors.successText }]}>  {mistake.right}</Text>
      </View>
      <Text style={[sty.mistakeExplanation, { color: colors.textSecondary }]}>{mistake.explanation}</Text>
    </View>
  );
}

function RegisterKeyCard({
  colors,
  askableRegisters,
}: {
  colors: ReturnType<typeof useColors>;
  askableRegisters: ReadonlySet<KeigoRegister>;
}) {
  return (
    <View
      testID="register-key-card"
      style={[sty.card, { backgroundColor: colors.card }]}
    >
      <Text style={[sty.introText, { color: colors.textPrimary }]}>
        Many verbs accept more than one correct keigo pattern. Flashcards label
        the alternatives they can ask for, while detail pages also show forms
        that depend on context. A card with no label asks for the canonical form.
      </Text>
      <View style={sty.typeList}>
        {REGISTER_ROWS.map((row) => {
          const key = row.register ?? 'canonical';
          const label = row.register
            ? KEIGO_REGISTER_LABELS[row.register]
            : null;
          return (
            <View
              key={key}
              testID={`register-row-${key}`}
              style={sty.registerRow}
            >
              {label ? (
                <Text
                  style={[
                    sty.registerBadge,
                    { backgroundColor: colors.pillBg, color: colors.pillText },
                  ]}
                >
                  {label}
                </Text>
              ) : (
                <Text
                  style={[
                    sty.registerBadge,
                    sty.registerBadgeEmpty,
                    { borderColor: colors.textMuted, color: colors.textMuted },
                  ]}
                >
                  No label
                </Text>
              )}
              <View style={sty.registerBody}>
                <Text style={[sty.typeDesc, { color: colors.textSecondary }]}>
                  {row.meaning}
                </Text>
                <Text style={[sty.registerStatus, { color: colors.textMuted }]}>
                  {registerAvailabilityText(row.register, askableRegisters)}
                </Text>
                <Text style={[sty.registerExample, { color: colors.textMuted }]}>
                  {row.example}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── main screen ─── */

export function PatternGuideContent({
  verbEntries,
}: {
  verbEntries: PatternGuideVerbEntry[];
}) {
  const colors = useColors();
  const askableRegisters = getAskableRegisters(verbEntries);

  return (
    <ScrollView style={[sty.container, { backgroundColor: colors.bg }]}>
      {/* ─── Section 1: What is Keigo? ─── */}
      <View style={sty.section}>
        <SectionHeader
          title="敬語とは"
          subtitle="What is Keigo?"
          color={colors.primary}
          bgColor={colors.pillBg}
        />
        <View style={[sty.card, { backgroundColor: colors.card }]}>
          <Text style={[sty.introText, { color: colors.textPrimary }]}>
            Keigo (敬語) is the Japanese system of honorific speech. It has three main types:
          </Text>
          <View style={sty.typeList}>
            <View style={sty.typeRow}>
              <View style={[sty.typeBadge, { backgroundColor: colors.sonkeigoTag }]}>
                <Text style={[sty.typeBadgeText, { color: colors.sonkeigoTagText }]}>尊敬語</Text>
              </View>
              <Text style={[sty.typeDesc, { color: colors.textSecondary }]}>
                Respectful — elevates the listener’s actions
              </Text>
            </View>
            <View style={sty.typeRow}>
              <View style={[sty.typeBadge, { backgroundColor: colors.kenjougoTag }]}>
                <Text style={[sty.typeBadgeText, { color: colors.kenjougoTagText }]}>謙譲語</Text>
              </View>
              <Text style={[sty.typeDesc, { color: colors.textSecondary }]}>
                Humble — lowers the speaker’s own actions
              </Text>
            </View>
            <View style={sty.typeRow}>
              <View style={[sty.typeBadge, { backgroundColor: colors.teineigoTag }]}>
                <Text style={[sty.typeBadgeText, { color: colors.teineigoTagText }]}>丁寧語</Text>
              </View>
              <Text style={[sty.typeDesc, { color: colors.textSecondary }]}>
                Polite — general polite sentence endings (です / ます)
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─── Section 1b: How card and Detail labels work ─── */}
      <View style={sty.section}>
        <SectionHeader
          title="カードと詳細の読み方"
          subtitle="What card and detail labels mean"
          color={colors.primary}
          bgColor={colors.pillBg}
        />
        <RegisterKeyCard
          colors={colors}
          askableRegisters={askableRegisters}
        />
      </View>

      {/* ─── Section 2: Sonkeigo ─── */}
      <View style={sty.section}>
        <SectionHeader
          title="尊敬語パターン"
          subtitle="Respectful Patterns"
          color={colors.sonkeigoTagText}
          bgColor={colors.sonkeigoTag}
        />
        {SONKEIGO_PATTERNS.map((p, i) => (
          <PatternCard key={i} index={i + 1} pattern={p} colors={colors} />
        ))}
        <SpecialVerbTable
          index={3}
          section={SONKEIGO_SPECIAL}
          tagText={colors.sonkeigoTagText}
          colors={colors}
        />
        <View style={[sty.card, { backgroundColor: colors.card }]}>
          <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>
            {registerPatternHeading('Pattern 4', 'less_formal', askableRegisters)}
          </Text>
          <FormulaBox formula={SONKEIGO_PASSIVE.formula} colors={colors} />
          {SONKEIGO_PASSIVE.examples.map((ex, i) => (
            <ExampleRow key={i} example={ex} colors={colors} />
          ))}
        </View>
      </View>

      {/* ─── Section 3: Kenjougo ─── */}
      <View style={sty.section}>
        <SectionHeader
          title="謙譲語パターン"
          subtitle="Humble Patterns"
          color={colors.kenjougoTagText}
          bgColor={colors.kenjougoTag}
        />
        {KENJOUGO_PATTERNS.map((p, i) => (
          <PatternCard key={i} index={i + 1} pattern={p} colors={colors} />
        ))}
        <SpecialVerbTable
          index={3}
          section={KENJOUGO_SPECIAL}
          tagText={colors.kenjougoTagText}
          colors={colors}
        />
        <View
          testID="kenjougo-itasu-card"
          style={[sty.card, { backgroundColor: colors.card }]}
        >
          <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>
            {registerPatternHeading(
              'More formal variant',
              'more_formal',
              askableRegisters,
            )}
          </Text>
          <FormulaBox formula={KENJOUGO_ITASU.formula} colors={colors} />
          {KENJOUGO_ITASU.examples.map((ex, i) => (
            <ExampleRow key={i} example={ex} colors={colors} />
          ))}
        </View>
        <View style={[sty.card, { backgroundColor: colors.card }]}>
          <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>
            {registerPatternHeading(
              'Pattern 4',
              'when_granted',
              askableRegisters,
            )}
          </Text>
          <FormulaBox formula={KENJOUGO_SASETE.formula} colors={colors} />
          {KENJOUGO_SASETE.examples.map((ex, i) => (
            <ExampleRow key={i} example={ex} colors={colors} />
          ))}
        </View>
      </View>

      {/* ─── Section 4: Teineigo ─── */}
      <View style={sty.section}>
        <SectionHeader
          title="丁寧語パターン"
          subtitle="Polite Patterns"
          color={colors.teineigoTagText}
          bgColor={colors.teineigoTag}
        />
        <View style={[sty.card, { backgroundColor: colors.card }]}>
          <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>です / ます forms</Text>
          <FormulaBox formula="verb-masu form / noun + です" colors={colors} />
          {TEINEIGO_EXAMPLES.map((ex, i) => (
            <ExampleRow key={i} example={ex} colors={colors} />
          ))}
        </View>
        <View style={[sty.card, { backgroundColor: colors.card }]}>
          <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>でございます (more formal)</Text>
          <FormulaBox formula="noun + でございます" colors={colors} />
          {TEINEIGO_GOZAIMASU.map((ex, i) => (
            <ExampleRow key={i} example={ex} colors={colors} />
          ))}
        </View>
        <View style={[sty.card, { backgroundColor: colors.card }]}>
          <Text style={[sty.patternLabel, { color: colors.textSecondary }]}>Common Upgrades</Text>
          <View style={[sty.tableHeaderRow, { borderBottomColor: colors.divider }]}>
            <Text style={[sty.tableHeaderCell, { color: colors.textMuted, flex: 1 }]}>Casual</Text>
            <Text style={[sty.tableHeaderCell, { color: colors.textMuted, flex: 1.5 }]}>Polite</Text>
            <Text style={[sty.tableHeaderCell, { color: colors.textMuted, flex: 1 }]}>Meaning</Text>
          </View>
          {TEINEIGO_UPGRADES.map((u, i) => (
            <TouchableOpacity
              key={i}
              style={[sty.tableRow, { borderBottomColor: colors.divider }]}
              onPress={() => speak(u.polite)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Play pronunciation of ${u.polite}`}
            >
              <Text style={[sty.tableCell, { color: colors.textSecondary, flex: 1 }]}>{u.casual}</Text>
              <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[sty.tableCellKeigo, { color: colors.teineigoTagText }]}>{u.polite}</Text>
                <Ionicons name="volume-medium-outline" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
              </View>
              <Text style={[sty.tableCell, { color: colors.textMuted, flex: 1, fontSize: fonts.sizes.xs }]}>{u.meaning}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── Section 5: Common Mistakes ─── */}
      <View style={sty.section}>
        <SectionHeader
          title="よくある間違い"
          subtitle="Common Mistakes"
          color={colors.errorText}
          bgColor={colors.errorBg}
        />
        {COMMON_MISTAKES.map((m, i) => (
          <MistakeCard key={i} mistake={m} colors={colors} />
        ))}
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

export default function PatternGuideScreen() {
  return <PatternGuideContent verbEntries={ALL_VERB_ENTRIES} />;
}

/* ─── styles ─── */

const sty = StyleSheet.create({
  container: { flex: 1 },

  section: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },

  sectionHeader: {
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
  },
  sectionSubtitle: {
    fontSize: fonts.sizes.sm,
    marginTop: spacing.xs,
    fontWeight: fonts.weights.medium,
  },

  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  introText: {
    fontSize: fonts.sizes.md,
    lineHeight: 24,
    marginBottom: spacing.md,
  },

  typeList: { gap: spacing.sm },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  typeBadgeText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  typeDesc: {
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  registerBadge: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
    minWidth: 104,
    textAlign: 'center',
  },
  registerBadgeEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  registerBody: { flex: 1 },
  registerStatus: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    marginTop: 2,
  },
  registerExample: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
  },

  patternLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.sm,
  },

  formulaBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  formulaText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },

  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exampleText: { flex: 1 },
  exampleJa: { fontSize: fonts.sizes.md },
  exampleEn: { fontSize: fonts.sizes.sm, marginTop: 2 },

  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderCell: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: {
    fontSize: fonts.sizes.sm,
  },
  tableCellKeigo: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },

  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mistakeWrong: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    textDecorationLine: 'line-through',
  },
  mistakeRight: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  mistakeExplanation: {
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
});
