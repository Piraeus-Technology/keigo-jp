import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { speak } from '../utils/speech';
import verbs from '../data/verbs.json';
import {
  VerbData,
  KeigoForm,
  BusinessLevel,
  KEIGO_FORM_LABELS,
  ALL_FORMS,
  ALL_LEVELS,
  LEVEL_LABELS,
} from '../utils/keigoTypes';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSpacedRepStore } from '../store/spacedRepStore';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

const quizzableForms: { key: KeigoForm; label: string }[] = [
  { key: 'sonkeigo', label: '尊敬語' },
  { key: 'kenjougo', label: '謙譲語' },
];

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
  const { totalQuestions, totalCorrect, bestStreak, loadStats, recordAnswer } = useQuizStore();
  const { loaded: weightsLoaded, loadWeights, recordResult, getWeight } = useSpacedRepStore();
  const [activeForms, setActiveForms] = useState<KeigoForm[]>(quizzableForms.map(f => f.key));
  const [activeLevels, setActiveLevels] = useState<BusinessLevel[]>([...ALL_LEVELS]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadStats();
    loadWeights();
  }, []);

  const filteredEntries = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level)),
    [activeLevels]
  );

  useEffect(() => {
    if (weightsLoaded && activeForms.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
      setSelectedAnswer(null);
    }
  }, [weightsLoaded, activeForms, activeLevels]);

  const isCorrect = selectedAnswer === question?.correctAnswer;
  const answered = selectedAnswer !== null;
  const allFormsSelected = activeForms.length === quizzableForms.length;
  const allLevelsSelected = activeLevels.length === ALL_LEVELS.length;

  const toggleForm = (form: KeigoForm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveForms(prev => {
      if (prev.includes(form)) {
        if (prev.length <= 1) return prev;
        return prev.filter(f => f !== form);
      }
      return [...prev, form];
    });
  };

  const toggleAllForms = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allFormsSelected) {
      setActiveForms(['sonkeigo']);
    } else {
      setActiveForms(quizzableForms.map(f => f.key));
    }
  };

  const toggleLevel = (level: BusinessLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveLevels(prev => {
      if (prev.includes(level)) {
        if (prev.length <= 1) return prev;
        return prev.filter(l => l !== level);
      }
      return [...prev, level];
    });
  };

  const toggleAllLevels = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allLevelsSelected) {
      setActiveLevels(['basic']);
    } else {
      setActiveLevels([...ALL_LEVELS]);
    }
  };

  const handleAnswer = (answer: string) => {
    if (answered || !question) return;
    setSelectedAnswer(answer);
    setSessionTotal(t => t + 1);

    const correct = answer === question.correctAnswer;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionScore(s => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      recordAnswer(true, newStreak);
      if (newStreak === 10) {
        StoreReview.isAvailableAsync().then((available) => {
          if (available) StoreReview.requestReview();
        });
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      recordAnswer(false, 0);
    }
    recordResult(question.verb, correct);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
    setSelectedAnswer(null);
  };

  const getOptionStyle = (option: string) => {
    if (!answered || !question) {
      return { backgroundColor: colors.card, borderColor: colors.border };
    }
    if (option === question.correctAnswer) {
      return { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' };
    }
    if (option === selectedAnswer && !isCorrect) {
      return { backgroundColor: '#FFEBEE', borderColor: '#E53935' };
    }
    return { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.4 };
  };

  const getOptionTextColor = (option: string) => {
    if (!answered || !question) return colors.textPrimary;
    if (option === question.correctAnswer) return '#2E7D32';
    if (option === selectedAnswer && !isCorrect) return '#C62828';
    return colors.textMuted;
  };

  if (!question) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching verbs</Text>
    </View>
  );

  const formLabel = KEIGO_FORM_LABELS[question.form];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Level chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ key: 'all', label: 'All' }, ...ALL_LEVELS.map(l => ({ key: l, label: LEVEL_LABELS[l] }))]}
        keyExtractor={(item) => 'level-' + item.key}
        contentContainerStyle={styles.chipBar}
        renderItem={({ item }) => {
          const isAll = item.key === 'all';
          const active = isAll ? allLevelsSelected : activeLevels.includes(item.key as BusinessLevel);
          return (
            <TouchableOpacity
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed' as const },
              ]}
              onPress={() => isAll ? toggleAllLevels() : toggleLevel(item.key as BusinessLevel)}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.textMuted }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Form filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ key: 'all' as KeigoForm, label: 'All' }, ...quizzableForms]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.chipBar}
        renderItem={({ item }) => {
          const isAll = item.key === 'all';
          const active = isAll ? allFormsSelected : activeForms.includes(item.key);
          return (
            <TouchableOpacity
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed' as const },
              ]}
              onPress={() => isAll ? toggleAllForms() : toggleForm(item.key)}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.textMuted }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Session score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{sessionScore}/{sessionTotal}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Session</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.accent }]}>{streak}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Streak</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
            {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
          </Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
        </View>
      </View>

      {/* All-time stats */}
      {totalQuestions > 0 && (
        <View style={[styles.allTimeBar, { borderColor: colors.divider }]}>
          <Text style={[styles.allTimeText, { color: colors.textMuted }]}>
            All-time: {totalCorrect}/{totalQuestions} ({Math.round((totalCorrect / totalQuestions) * 100)}%) · Best streak: {bestStreak}
          </Text>
        </View>
      )}

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
          {formLabel.ja} — {formLabel.en}
        </Text>
        <Text style={[styles.questionVerb, { color: colors.primary }]}>
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
          >
            <Text style={[styles.optionText, { color: getOptionTextColor(option) }]}>
              {option}
            </Text>
            {answered && option === question.correctAnswer && (
              <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            )}
            {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
              <Ionicons name="close-circle" size={22} color="#E53935" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Next button */}
      {answered && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  chipBar: { gap: spacing.xs, paddingBottom: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },
  scoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  scoreItem: { alignItems: 'center' },
  allTimeBar: {
    borderTopWidth: 1,
    marginHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  allTimeText: { fontSize: fonts.sizes.xs, textAlign: 'center' },
  scoreValue: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold },
  scoreLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionContainer: { alignItems: 'center', marginBottom: spacing.xl },
  questionLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  questionVerb: { fontSize: 36, fontWeight: fonts.weights.bold, marginBottom: spacing.xs },
  questionReading: { fontSize: fonts.sizes.lg, marginBottom: spacing.xs },
  questionTranslation: { fontSize: fonts.sizes.md, fontStyle: 'italic' },
  optionsContainer: { gap: spacing.sm },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold, flex: 1 },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  nextButtonText: { color: '#fff', fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold },
});
