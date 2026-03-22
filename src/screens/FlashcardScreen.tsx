import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import { speak } from '../utils/speech';
import {
  VerbData,
  ExpressionData,
  KeigoForm,
  BusinessLevel,
  KEIGO_FORM_LABELS,
  ALL_LEVELS,
  LEVEL_LABELS,
} from '../utils/keigoTypes';
import { useColors, fonts, spacing, radius } from '../utils/theme';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const allExpressionEntries = Object.entries(expressions as Record<string, ExpressionData>);

const flashcardForms: { key: KeigoForm; label: string }[] = [
  { key: 'sonkeigo', label: '尊敬語' },
  { key: 'kenjougo', label: '謙譲語' },
];

type CardType = 'verb' | 'expression';

interface Card {
  key: string;
  reading: string;
  translation: string;
  form?: KeigoForm;
  answer: string;
  answerReading: string;
  cardType: CardType;
}

function generateCard(
  filteredVerbs: [string, VerbData][],
  filteredExpressions: [string, ExpressionData][],
  includeExpressions: boolean,
): Card {
  const useExpression = includeExpressions && filteredExpressions.length > 0 && Math.random() < 0.3;

  if (useExpression) {
    const idx = Math.floor(Math.random() * filteredExpressions.length);
    const [key, data] = filteredExpressions[idx];
    return {
      key: data.translation,
      reading: '',
      translation: data.translation,
      answer: key,
      answerReading: data.reading,
      cardType: 'expression',
    };
  }

  const entries = filteredVerbs.length > 0 ? filteredVerbs : allVerbEntries;
  const idx = Math.floor(Math.random() * entries.length);
  const [verb, data] = entries[idx];
  const form = flashcardForms[Math.floor(Math.random() * flashcardForms.length)].key;
  const formData = form === 'teineigo' ? data.teineigo : data[form];

  return {
    key: verb,
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
  const [activeLevels, setActiveLevels] = useState<BusinessLevel[]>([...ALL_LEVELS]);
  const [includeExpressions, setIncludeExpressions] = useState(true);

  const filteredVerbs = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.level)),
    [activeLevels]
  );
  const filteredExpressions = useMemo(() =>
    allExpressionEntries.filter(([, d]) => activeLevels.includes(d.level)),
    [activeLevels]
  );

  const [card, setCard] = useState<Card>(() => generateCard(allVerbEntries, allExpressionEntries, true));
  const [flipped, setFlipped] = useState(false);
  const [count, setCount] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const allLevelsSelected = activeLevels.length === ALL_LEVELS.length;

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

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (flipped) {
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCard(generateCard(filteredVerbs, filteredExpressions, includeExpressions));
        setFlipped(false);
        setCount(c => c + 1);
      });
    } else {
      setFlipped(true);
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const formLabel = card.form ? KEIGO_FORM_LABELS[card.form] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Level chips */}
      <View style={styles.chipBarWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: 'all', label: 'All' },
            ...ALL_LEVELS.map(l => ({ key: l, label: LEVEL_LABELS[l] })),
          ]}
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
      </View>

      <Text style={[styles.counter, { color: colors.textMuted }]}>
        {count} cards reviewed
      </Text>

      <TouchableOpacity
        style={styles.cardContainer}
        onPress={flip}
        activeOpacity={0.95}
      >
        {/* Front */}
        <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: frontOpacity }]}>
          {formLabel && (
            <Text style={[styles.formLabel, { color: colors.textMuted }]}>
              {formLabel.ja} — {formLabel.en}
            </Text>
          )}
          {card.cardType === 'expression' ? (
            <>
              <Text style={[styles.translationText, { color: colors.primary, fontSize: fonts.sizes.lg, textAlign: 'center' }]}>
                {card.translation}
              </Text>
              <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: spacing.sm }]}>
                How do you say this in keigo?
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.verbText, { color: colors.primary }]}>{card.key}</Text>
              <Text style={[styles.readingText, { color: colors.textSecondary }]}>{card.reading}</Text>
              <Text style={[styles.translationText, { color: colors.textSecondary }]}>{card.translation}</Text>
            </>
          )}
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to reveal</Text>
        </Animated.View>

        {/* Back */}
        <Animated.View style={[styles.card, styles.cardBack, { backgroundColor: colors.primary + '10', opacity: backOpacity }]}>
          {formLabel && (
            <Text style={[styles.formLabel, { color: colors.textMuted }]}>
              {formLabel.ja} — {formLabel.en}
            </Text>
          )}
          <Text style={[styles.answerText, { color: colors.primary }]}>{card.answer}</Text>
          {card.answer !== card.answerReading && (
            <Text style={[styles.readingText, { color: colors.textSecondary }]}>{card.answerReading}</Text>
          )}
          {card.cardType === 'verb' && (
            <Text style={[styles.contextText, { color: colors.textSecondary }]}>
              {card.key} · {card.reading}
            </Text>
          )}
          <Text style={[styles.answerTranslation, { color: colors.textMuted }]}>{card.translation}</Text>
          <TouchableOpacity
            style={[styles.speakButton, { backgroundColor: colors.primary }]}
            onPress={(e) => {
              e.stopPropagation?.();
              speak(card.answerReading || card.answer);
            }}
          >
            <Ionicons name="volume-medium" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap for next card</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chipBarWrapper: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    right: 0,
  },
  chipBar: { gap: spacing.xs, paddingHorizontal: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },
  counter: {
    fontSize: fonts.sizes.sm,
    position: 'absolute',
    top: spacing.lg + 40,
  },
  cardContainer: {
    width: width - spacing.lg * 2,
    height: 360,
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
  },
  cardBack: {
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  formLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  verbText: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
  },
  readingText: {
    fontSize: fonts.sizes.lg,
    marginBottom: spacing.xs,
  },
  translationText: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
  },
  answerText: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  answerTranslation: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  contextText: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.lg,
  },
  speakButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tapHint: {
    fontSize: fonts.sizes.xs,
    position: 'absolute',
    bottom: spacing.lg,
  },
});
