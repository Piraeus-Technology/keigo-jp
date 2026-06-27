import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { stopSpeech } from '../utils/speech';
import verbs from '../data/verbs.json';
import {
  VerbData,
  KeigoForm,
  BusinessLevel,
  KEIGO_FORM_LABELS,
} from '../utils/keigoTypes';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { getTodayKey } from '../utils/dayKey';
import { useQuizStore } from '../store/quizStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useSessionStore } from '../store/sessionStore';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import type { QuizStackParamList } from '../types/navigation';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

interface Question {
  verb: string;
  reading: string;
  translation: string;
  form: KeigoForm;
  correctAnswer: string;
  correctReading: string;
  options: string[];
}

function getFormValue(data: VerbData, form: KeigoForm): { form: string; reading: string } {
  if (form === 'teineigo') return data.teineigo;
  return data[form];
}

function generateQuestion(
  activeForms: KeigoForm[],
  getWeight: (key: string) => number,
  filteredEntries: [string, VerbData][],
): Question {
  const entries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  const candidates: number[] = [];
  for (let i = 0; i < 10; i++) {
    candidates.push(Math.floor(Math.random() * entries.length));
  }
  const verbIndex = candidates.reduce((best, idx) => {
    const bestWeight = getWeight(entries[best][0]);
    const thisWeight = getWeight(entries[idx][0]);
    return thisWeight > bestWeight ? idx : best;
  }, candidates[0]);

  const [verb, data] = entries[verbIndex];
  const form = activeForms[Math.floor(Math.random() * activeForms.length)];
  const formValue = getFormValue(data, form);
  const correctAnswer = formValue.form;
  const correctReading = formValue.reading;

  const wrongAnswers = new Set<string>();

  // Same verb, different form
  for (const f of activeForms) {
    if (f === form) continue;
    const wrong = getFormValue(data, f).form;
    if (wrong !== correctAnswer) wrongAnswers.add(wrong);
  }

  // Same form, different verbs
  for (let i = 0; i < 20 && wrongAnswers.size < 6; i++) {
    const [, otherData] = entries[Math.floor(Math.random() * entries.length)];
    const wrong = getFormValue(otherData, form).form;
    if (wrong !== correctAnswer) wrongAnswers.add(wrong);
  }

  const wrongArray = Array.from(wrongAnswers);
  const selected: string[] = [];
  while (selected.length < 3 && wrongArray.length > 0) {
    const idx = Math.floor(Math.random() * wrongArray.length);
    selected.push(wrongArray.splice(idx, 1)[0]);
  }

  while (selected.length < 3) {
    const [, otherData] = allVerbEntries[Math.floor(Math.random() * allVerbEntries.length)];
    const wrong = getFormValue(otherData, form).form;
    if (wrong !== correctAnswer && !selected.includes(wrong)) {
      selected.push(wrong);
    }
  }

  const options = [correctAnswer, ...selected];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { verb, reading: data.reading, translation: data.translation, form, correctAnswer, correctReading, options };
}

export default function QuizScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList, 'QuizMain'>>();
  const { totalQuestions, totalCorrect, bestStreak, loadStats, recordAnswer } = useQuizStore();
  const { loaded: weightsLoaded, loadWeights, recordResult, getWeight } = useSpacedRepStore();
  const { activeForms, activeLevels, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const { sessions, loadSessions, saveSession } = useSessionStore();
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  // This-visit answers (monotonic); persisted as deltas by useSessionAutosave.
  const [newCorrect, setNewCorrect] = useState(0);
  const [newTotal, setNewTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestSessionStreak, setBestSessionStreak] = useState(0);

  useEffect(() => {
    loadStats();
    loadWeights();
    loadPracticeSettings();
    loadSessions();
  }, []);

  useFocusEffect(useCallback(() => () => stopSpeech(), []));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('PracticeSettings', { mode: 'quiz' })}
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

  const filteredEntries = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level as BusinessLevel)),
    [activeLevels]
  );

  useEffect(() => {
    if (weightsLoaded && settingsLoaded && activeForms.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
      setSelectedAnswer(null);
    }
  }, [weightsLoaded, settingsLoaded, activeForms, activeLevels]);

  const isCorrect = selectedAnswer === question?.correctAnswer;
  const answered = selectedAnswer !== null;

  const handleAnswer = (answer: string) => {
    if (answered || !question) return;
    setSelectedAnswer(answer);
    setNewTotal(t => t + 1);

    const correct = answer === question.correctAnswer;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewCorrect(s => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestSessionStreak) setBestSessionStreak(newStreak);
      recordAnswer(true, newStreak);
      if (newStreak === 10) {
        StoreReview.isAvailableAsync().then((available) => {
          if (available) StoreReview.requestReview();
        }).catch(() => {});
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      recordAnswer(false, 0);
    }
    recordResult(question.verb, correct).catch(() => {});
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
    setSelectedAnswer(null);
  };

  // Auto-save new answers on blur / background / unmount (delta-based).
  const { unsavedCount, unsavedCorrect } = useSessionAutosave({
    count: newTotal,
    correct: newCorrect,
    bestStreak: bestSessionStreak,
    save: async ({ count, correct, bestStreak }) => {
      if (!(await saveSession({ total: count, correct, streak: bestStreak }))) {
        throw new Error('quiz session save failed');
      }
    },
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todaySession = sessions.find(s => s.day === getTodayKey());
  const sessionTotal = (todaySession?.total || 0) + unsavedCount;
  const sessionScore = (todaySession?.correct || 0) + unsavedCorrect;

  const getOptionStyle = (option: string) => {
    if (!answered || !question) {
      return { backgroundColor: colors.card, borderColor: colors.border };
    }
    if (option === question.correctAnswer) {
      return { backgroundColor: colors.successBg, borderColor: colors.successText };
    }
    if (option === selectedAnswer && !isCorrect) {
      return { backgroundColor: colors.errorBg, borderColor: colors.errorText };
    }
    return { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.4 };
  };

  const getOptionTextColor = (option: string) => {
    if (!answered || !question) return colors.textPrimary;
    if (option === question.correctAnswer) return colors.successText;
    if (option === selectedAnswer && !isCorrect) return colors.errorText;
    return colors.textMuted;
  };

  if (!question) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching verbs</Text>
    </View>
  );

  const formLabel = KEIGO_FORM_LABELS[question.form];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        {/* Session score bar */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.primary }]}>{sessionTotal}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Reviewed</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.successText }]}>{sessionScore}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Got It</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.errorText }]}>{sessionTotal - sessionScore}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Missed</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
                {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
            </View>
          </View>
          {totalQuestions > 0 && (
            <Text style={[styles.allTimeText, { color: colors.textMuted }]}>
              All-time: {totalCorrect}/{totalQuestions} ({Math.round((totalCorrect / totalQuestions) * 100)}%) · Best streak: {bestStreak}
            </Text>
          )}
        </View>

        {/* Question — fills remaining space */}
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
            {formLabel.ja} — {formLabel.en}
          </Text>
          <Text
            style={[styles.questionVerb, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {question.verb}
          </Text>
          <Text style={[styles.questionReading, { color: colors.textSecondary }]}>
            {question.reading}
          </Text>
          <Text style={[styles.questionTranslation, { color: colors.textSecondary }]}>
            {question.translation}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.optionButton, getOptionStyle(option)]}
              onPress={() => handleAnswer(option)}
              activeOpacity={answered ? 1 : 0.7}
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={`Answer: ${option}`}
              accessibilityState={{ disabled: answered, selected: selectedAnswer === option }}
            >
              <Text
                style={[styles.optionText, { color: getOptionTextColor(option) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {option}
              </Text>
              {answered && option === question.correctAnswer && (
                <Ionicons name="checkmark-circle" size={22} color={colors.successText} style={{ marginLeft: 8 }} />
              )}
              {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
                <Ionicons name="close-circle" size={22} color={colors.errorText} style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Answer reading reveal */}
        {answered && (
          <View style={[styles.revealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.revealText, { color: colors.textSecondary }]}>
              {question.correctAnswer}
              {question.correctReading && question.correctReading !== question.correctAnswer
                ? ` · ${question.correctReading}`
                : ''}
            </Text>
          </View>
        )}

        {/* Next */}
        <View style={[styles.bottomRow, { opacity: answered ? 1 : 0 }]} pointerEvents={answered ? 'auto' : 'none'}>
          <TouchableOpacity
            style={[styles.bottomButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next question"
            accessibilityState={{ disabled: !answered }}
          >
            <Text style={styles.bottomButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    justifyContent: 'space-between',
  },
  scoreCard: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreItem: {
    alignItems: 'center',
  },
  allTimeText: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  scoreValue: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
  },
  scoreLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  questionVerb: {
    fontSize: 32,
    fontWeight: fonts.weights.bold,
    marginBottom: 2,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  questionReading: {
    fontSize: fonts.sizes.lg,
    marginBottom: 2,
  },
  questionTranslation: {
    fontSize: fonts.sizes.sm,
    fontStyle: 'italic',
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  revealCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  revealText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
});
