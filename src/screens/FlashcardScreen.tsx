import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AppState,
  useWindowDimensions,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import { speak, stopSpeech } from '../utils/speech';
import SpeakButton from '../components/SpeakButton';
import {
  VerbData,
  ExpressionData,
  KeigoForm,
  BusinessLevel,
  KEIGO_FORM_LABELS,
} from '../utils/keigoTypes';
import {
  getGradableForms,
  getVerbFormData,
} from '../utils/gradableVerbs';
import { isLongExpression } from '../utils/expressionDisplay';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useFlashcardStatsStore } from '../store/flashcardStatsStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useThemeStore } from '../store/themeStore';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { getTodayKey } from '../utils/dayKey';
import type { FlashcardStackParamList } from '../types/navigation';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const allExpressionEntries = Object.entries(expressions as Record<string, ExpressionData>);

type CardType = 'verb' | 'expression';

export interface Card {
  srKey: string; // spaced-rep key: verb kanji or expression headword
  front: string; // verb kanji or expression translation prompt
  reading: string;
  translation: string;
  form?: KeigoForm;
  answer: string;
  answerReading: string;
  cardType: CardType;
}

export function FlashcardAnswerText({
  card,
  color,
}: {
  card: Card;
  color: string;
}) {
  const usesLongExpressionLayout =
    card.cardType === 'expression' && isLongExpression(card.answer);

  return (
    <Text
      style={[
        styles.answerText,
        usesLongExpressionLayout && styles.longExpressionAnswerText,
        { color },
      ]}
      numberOfLines={usesLongExpressionLayout ? undefined : 2}
      adjustsFontSizeToFit={!usesLongExpressionLayout}
    >
      {card.answer}
    </Text>
  );
}

const MIN_SELECTION_WEIGHT = 0.2;
const RECENT_CARD_MULTIPLIER = 0.25;
const RECENT_CARD_WINDOW = 3;

export function filterEntriesByLevels<T extends { level: string }>(
  entries: [string, T][],
  activeLevels: BusinessLevel[],
): [string, T][] {
  return entries.filter(([, data]) => activeLevels.includes(data.level as BusinessLevel));
}

export function selectWeightedEntry<T>(
  entries: [string, T][],
  getWeight: (key: string) => number,
  recentKeys: string[],
  random: () => number = Math.random,
): [string, T] | null {
  if (entries.length === 0) return null;

  const recent = new Set(recentKeys);
  const weightedEntries = entries.map((entry) => {
    const storedWeight = getWeight(entry[0]);
    const safeWeight =
      Number.isFinite(storedWeight) && storedWeight > 0
        ? Math.max(MIN_SELECTION_WEIGHT, storedWeight)
        : 1;
    // Square-root scaling keeps weak cards meaningfully favored without
    // allowing a few max-weight cards to dominate a long review run.
    const selectionWeight =
      Math.sqrt(safeWeight) * (recent.has(entry[0]) ? RECENT_CARD_MULTIPLIER : 1);
    return { entry, selectionWeight };
  });
  const totalWeight = weightedEntries.reduce(
    (total, item) => total + item.selectionWeight,
    0,
  );
  const boundedRandom = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  let target = boundedRandom * totalWeight;

  for (const item of weightedEntries) {
    if (target < item.selectionWeight) return item.entry;
    target -= item.selectionWeight;
  }
  return weightedEntries[weightedEntries.length - 1].entry;
}

export function generateCard(
  filteredVerbs: [string, VerbData][],
  filteredExpressions: [string, ExpressionData][],
  includeExpressions: boolean,
  activeForms: KeigoForm[],
  getWeight: (key: string) => number,
  recentKeys: string[],
  random: () => number = Math.random,
): Card | null {
  const useExpression =
    includeExpressions && filteredExpressions.length > 0 && random() < 0.3;

  if (useExpression) {
    const selected = selectWeightedEntry(
      filteredExpressions,
      getWeight,
      recentKeys,
      random,
    );
    if (!selected) return null;
    const [key, data] = selected;
    return {
      srKey: key,
      front: data.translation,
      reading: '',
      translation: data.translation,
      answer: key,
      answerReading: data.reading,
      cardType: 'expression',
    };
  }

  if (filteredVerbs.length === 0 || activeForms.length === 0) return null;
  const eligibleVerbs = filteredVerbs.filter(([verb, data]) =>
    getGradableForms(verb, data, activeForms).length > 0
  );
  const selected = selectWeightedEntry(eligibleVerbs, getWeight, recentKeys, random);
  if (!selected) return null;
  const [verb, data] = selected;
  const eligibleForms = getGradableForms(verb, data, activeForms);
  const form = eligibleForms[Math.floor(random() * eligibleForms.length)];
  const formData = getVerbFormData(data, form);
  return {
    srKey: verb,
    front: verb,
    reading: data.reading,
    translation: data.translation,
    form,
    answer: formData.form,
    answerReading: formData.reading,
    cardType: 'verb',
  };
}

export default function FlashcardScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<FlashcardStackParamList, 'FlashcardMain'>>();
  const { activeForms, activeLevels, includeExpressions, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const { sessions, loadSessions, saveSession } = useFlashcardSessionStore();
  const { loadStats, recordReview } = useFlashcardStatsStore();
  const { loaded: weightsLoaded, loadWeights, recordResult, getWeight } = useSpacedRepStore();
  const { autoTTS } = useThemeStore();

  const filteredVerbs = useMemo(() =>
    filterEntriesByLevels(allVerbEntries, activeLevels),
    [activeLevels]
  );
  const filteredExpressions = useMemo(() =>
    filterEntriesByLevels(allExpressionEntries, activeLevels),
    [activeLevels]
  );

  const [card, setCard] = useState<Card | null>(() =>
    generateCard(
      allVerbEntries,
      allExpressionEntries,
      true,
      ['sonkeigo', 'kenjougo'],
      () => 1,
      [],
    ));
  const [flipped, setFlipped] = useState(false);
  // This-visit answers (monotonic); persisted as deltas by useSessionAutosave.
  const [newReviewed, setNewReviewed] = useState(0);
  const [newCorrect, setNewCorrect] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const hasGradedCard = useRef(false);
  const recentCardKeys = useRef<string[]>(card ? [card.srKey] : []);
  const speechGate = useRef({
    focused: true,
    appState: AppState.currentState as AppStateStatus,
  });

  useEffect(() => {
    loadPracticeSettings();
    loadSessions();
    loadStats();
    loadWeights();
  }, [loadPracticeSettings, loadSessions, loadStats, loadWeights]);

  useFocusEffect(useCallback(() => {
    speechGate.current.focused = true;
    return () => {
      speechGate.current.focused = false;
      stopSpeech();
    };
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      speechGate.current.appState = state;
      if (state === 'background' || state === 'inactive') {
        stopSpeech();
      }
    });
    return () => sub.remove();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('PracticeSettings', { mode: 'flashcards' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Open form and level settings"
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Forms</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const selectNextCard = useCallback(() => {
    const next = generateCard(
      filteredVerbs,
      filteredExpressions,
      includeExpressions,
      activeForms,
      getWeight,
      recentCardKeys.current,
    );
    if (next) {
      recentCardKeys.current = [
        next.srKey,
        ...recentCardKeys.current.filter((key) => key !== next.srKey),
      ].slice(0, RECENT_CARD_WINDOW);
    }
    return next;
  }, [activeForms, filteredExpressions, filteredVerbs, getWeight, includeExpressions]);

  useEffect(() => {
    if (!settingsLoaded) return;
    flipAnim.stopAnimation(() => {
      flipAnim.setValue(0);
      isAnimating.current = false;
      hasGradedCard.current = false;
      recentCardKeys.current = [];
      setFlipped(false);
      setCard(selectNextCard());
    });
  }, [settingsLoaded, weightsLoaded, flipAnim, selectNextCard]);

  const flipToFront = () => {
    isAnimating.current = true;
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isAnimating.current = false;
        hasGradedCard.current = false;
        return;
      }
      setCard(selectNextCard());
      setFlipped(false);
      isAnimating.current = false;
      hasGradedCard.current = false;
    });
  };

  const flip = () => {
    if (!card || isAnimating.current || flipped) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlipped(true);
    isAnimating.current = true;
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      isAnimating.current = false;
      if (
        autoTTS &&
        speechGate.current.focused &&
        speechGate.current.appState === 'active'
      ) {
        speak(card.answerReading || card.answer);
      }
    });
  };

  const handleGotIt = () => {
    if (!card || !flipped || hasGradedCard.current) return;
    hasGradedCard.current = true;
    setFlipped(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewReviewed(r => r + 1);
    setNewCorrect(c => c + 1);
    recordReview(true).catch(() => {});
    recordResult(card.srKey, true).catch(() => {});
    flipToFront();
  };

  const handleMissed = () => {
    if (!card || !flipped || hasGradedCard.current) return;
    hasGradedCard.current = true;
    setFlipped(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setNewReviewed(r => r + 1);
    recordReview(false).catch(() => {});
    recordResult(card.srKey, false).catch(() => {});
    flipToFront();
  };

  // Auto-save new answers on blur / background / unmount (delta-based).
  const { unsavedCount, unsavedCorrect } = useSessionAutosave({
    count: newReviewed,
    correct: newCorrect,
    save: async ({ count, correct, day }) => {
      if (!(await saveSession({ reviewed: count, correct }, day))) {
        throw new Error('flashcard session save failed');
      }
    },
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todaySession = sessions.find(s => s.day === getTodayKey());
  const reviewed = (todaySession?.reviewed || 0) + unsavedCount;
  const correct = (todaySession?.correct || 0) + unsavedCorrect;

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  if (!card) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching cards</Text>
    </View>
  );

  const formLabel = card.form ? KEIGO_FORM_LABELS[card.form] : null;
  const usesLongExpressionLayout =
    card.cardType === 'expression' && isLongExpression(card.answer);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Today's score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.primary }]}>{reviewed}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Reviewed</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.successText }]}>{correct}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Got It</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.errorText }]}>{reviewed - correct}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Missed</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
              {reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0}%
            </Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
        </View>
      </View>

      <View style={styles.practiceArea}>
        <TouchableOpacity
          style={[styles.cardContainer, { width: width - spacing.lg * 2 }]}
          onPress={flip}
          activeOpacity={0.95}
          accessible={!flipped}
          accessibilityRole="button"
          accessibilityLabel={
            !flipped
              ? `Flashcard prompt: ${card.front}. Tap to reveal the answer.`
              : undefined
          }
          accessibilityState={{ disabled: flipped }}
        >
          {/* Front */}
          <Animated.View
            accessibilityElementsHidden={flipped}
            importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
            pointerEvents={flipped ? 'none' : 'auto'}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
              },
            ]}
          >
            {card.cardType === 'expression' ? (
              <>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  How do you say this in keigo?
                </Text>
                <Text
                  style={[styles.translationPrompt, { color: colors.primary }]}
                  adjustsFontSizeToFit
                  numberOfLines={3}
                >
                  {card.front}
                </Text>
              </>
            ) : (
              <>
                {formLabel && (
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                    {formLabel.ja} — {formLabel.en}
                  </Text>
                )}
                <Text
                  style={[styles.verbText, { color: colors.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {card.front}
                </Text>
                <Text style={[styles.readingText, { color: colors.textSecondary }]}>
                  {card.reading}
                </Text>
                <Text style={[styles.translationText, { color: colors.textSecondary }]}>
                  {card.translation}
                </Text>
              </>
            )}
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to reveal</Text>
          </Animated.View>

          {/* Back */}
          <Animated.View
            accessibilityElementsHidden={!flipped}
            importantForAccessibility={!flipped ? 'no-hide-descendants' : 'auto'}
            pointerEvents={flipped ? 'auto' : 'none'}
            style={[
              styles.card,
              styles.cardBack,
              usesLongExpressionLayout && styles.longExpressionCardBack,
              {
                backgroundColor: colors.primary + '10',
                borderColor: colors.divider,
                transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
              },
            ]}
          >
            {formLabel && (
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                {formLabel.ja} — {formLabel.en}
              </Text>
            )}
            <FlashcardAnswerText card={card} color={colors.primary} />
            {card.answerReading && card.answerReading !== card.answer && (
              <Text
                style={[
                  styles.readingText,
                  usesLongExpressionLayout && styles.longExpressionReadingText,
                  { color: colors.textSecondary },
                ]}
              >
                {card.answerReading}
              </Text>
            )}
            {card.cardType === 'verb' && (
              <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                {card.front} · {card.reading}
              </Text>
            )}
            <Text
              style={[
                styles.answerTranslation,
                usesLongExpressionLayout && styles.longExpressionTranslation,
                { color: colors.textMuted },
              ]}
            >
              {card.translation}
            </Text>
            <SpeakButton
              text={card.answerReading || card.answer}
              size={20}
              color={colors.pillActiveText}
              backgroundColor={colors.primary}
              style={[
                styles.speakButton,
                usesLongExpressionLayout && styles.longExpressionSpeakButton,
              ]}
              accessibilityLabel={`Play pronunciation of ${card.answer}`}
            />
          </Animated.View>
        </TouchableOpacity>

        {/* Got it / Missed buttons */}
        <View
          style={[styles.buttonRow, { opacity: flipped ? 1 : 0 }]}
          pointerEvents={flipped ? 'auto' : 'none'}
          accessibilityElementsHidden={!flipped}
          importantForAccessibility={!flipped ? 'no-hide-descendants' : 'auto'}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.errorBg, borderColor: colors.errorText }]}
            onPress={handleMissed}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as missed"
            accessibilityState={{ disabled: !flipped }}
          >
            <Ionicons name="close" size={20} color={colors.errorText} />
            <Text style={[styles.actionButtonText, { color: colors.errorText }]}>Missed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.successBg, borderColor: colors.successText }]}
            onPress={handleGotIt}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as got it"
            accessibilityState={{ disabled: !flipped }}
          >
            <Ionicons name="checkmark" size={20} color={colors.successText} />
            <Text style={[styles.actionButtonText, { color: colors.successText }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scoreBar: {
    alignSelf: 'stretch',
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-around' },
  scoreItem: { alignItems: 'center' },
  scoreValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold },
  scoreLabel: { fontSize: fonts.sizes.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  practiceArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardContainer: {
    height: 400,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    borderWidth: 2,
  },
  longExpressionCardBack: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  formLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  verbText: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  translationPrompt: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.semibold,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  readingText: {
    fontSize: fonts.sizes.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  translationText: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  answerText: {
    fontSize: 40,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  longExpressionAnswerText: {
    fontSize: fonts.sizes.xl,
    lineHeight: 32,
  },
  answerTranslation: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  longExpressionReadingText: {
    fontSize: fonts.sizes.md,
    lineHeight: 22,
  },
  longExpressionTranslation: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
  },
  contextText: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  speakButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  longExpressionSpeakButton: {
    marginBottom: 0,
  },
  tapHint: {
    fontSize: fonts.sizes.xs,
    position: 'absolute',
    bottom: spacing.lg,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  actionButtonText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold },
});
