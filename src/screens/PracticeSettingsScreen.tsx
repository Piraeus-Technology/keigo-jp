import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import {
  KeigoForm,
  BusinessLevel,
  KEIGO_FORM_LABELS,
  LEVEL_LABELS,
} from '../utils/keigoTypes';
import { usePracticeSettingsStore, allForms, allLevels } from '../store/practiceSettingsStore';
import type { PracticeSettingsParams, QuizStackParamList } from '../types/navigation';

type PracticeSettingsRouteParamList = {
  PracticeSettings: PracticeSettingsParams;
};

export default function PracticeSettingsScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList, 'PracticeSettings'>>();
  const route = useRoute<RouteProp<PracticeSettingsRouteParamList, 'PracticeSettings'>>();
  const mode = route.params.mode;

  const {
    activeForms, activeLevels, includeExpressions,
    loadPracticeSettings, toggleForm, toggleLevel, toggleIncludeExpressions,
    setActiveForms, setActiveLevels,
  } = usePracticeSettingsStore();

  useEffect(() => {
    loadPracticeSettings();
  }, []);

  const allFormsSelected = activeForms.length === allForms.length;
  const allLevelsSelected = activeLevels.length === allLevels.length;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  const formItems = allForms.map((f) => ({
    key: f,
    label: `${KEIGO_FORM_LABELS[f].ja} (${KEIGO_FORM_LABELS[f].en})`,
  }));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Forms */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Keigo Forms</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveForms(allFormsSelected ? ['sonkeigo'] : [...allForms]);
          }}
          accessibilityRole="button"
          accessibilityLabel={allFormsSelected ? 'Deselect all forms' : 'Select all forms'}
        >
          <Text style={[styles.selectAllText, { color: colors.primary }]}>
            {allFormsSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {formItems.map((item, i) => {
          const active = activeForms.includes(item.key as KeigoForm);
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.row,
                i < formItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleForm(item.key as KeigoForm);
              }}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={item.label}
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{item.label}</Text>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.primary : colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Levels */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Levels</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveLevels(allLevelsSelected ? ['basic'] : [...allLevels]);
          }}
          accessibilityRole="button"
          accessibilityLabel={allLevelsSelected ? 'Deselect all levels' : 'Select all levels'}
        >
          <Text style={[styles.selectAllText, { color: colors.primary }]}>
            {allLevelsSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {allLevels.map((level, i) => {
          const active = activeLevels.includes(level);
          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.row,
                i < allLevels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleLevel(level);
              }}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={LEVEL_LABELS[level]}
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{LEVEL_LABELS[level]}</Text>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.accent : colors.border}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Flashcard-only: include expression cards */}
      {mode === 'flashcards' && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Cards</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Include expressions</Text>
              <Switch
                value={includeExpressions}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleIncludeExpressions();
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                accessibilityLabel="Include expression cards"
              />
            </View>
          </View>
        </>
      )}

      {/* Start button */}
      <TouchableOpacity
        style={[styles.startButton, { backgroundColor: colors.primary }]}
        onPress={handleStart}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={mode === 'quiz' ? 'Start quiz' : 'Start flashcards'}
      >
        <Ionicons name="play" size={20} color="#fff" />
        <Text style={styles.startButtonText}>
          {mode === 'quiz' ? 'Start Quiz' : 'Start Flashcards'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectAllText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
  },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  startButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
});
