import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';

import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useFavoritesStore } from '../store/favoritesStore';
import { speak } from '../utils/speech';
import {
  VerbData,
  ExpressionData,
  KEIGO_FORM_LABELS,
  KeigoForm,
  CATEGORY_LABELS,
  LEVEL_LABELS,
} from '../utils/keigoTypes';

export default function DetailScreen() {
  const colors = useColors();
  const route = useRoute<any>();
  const key: string = route.params.key;
  const type: 'verb' | 'expression' = route.params.type;
  const { isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore();

  React.useEffect(() => {
    loadFavorites();
  }, []);

  if (type === 'expression') {
    const data = (expressions as Record<string, ExpressionData>)[key];
    if (!data) {
      return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <Text style={{ color: colors.textPrimary }}>Expression not found</Text>
        </View>
      );
    }

    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Text style={[styles.verb, { color: colors.primary, fontSize: fonts.sizes.xxl }]}>{key}</Text>
              <TouchableOpacity onPress={() => speak(key)}>
                <Ionicons name="volume-medium" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => toggleFavorite(key)}>
              <Ionicons
                name={isFavorite(key) ? 'heart' : 'heart-outline'}
                size={28}
                color={isFavorite(key) ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.reading, { color: colors.textSecondary }]}>{data.reading}</Text>
          <Text style={[styles.translation, { color: colors.textPrimary }]}>{data.translation}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.tag, { backgroundColor: colors.expressionTag }]}>
              <Text style={[styles.tagText, { color: colors.expressionTagText }]}>
                {CATEGORY_LABELS[data.category].ja} ({CATEGORY_LABELS[data.category].en})
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>{LEVEL_LABELS[data.level]}</Text>
            </View>
          </View>
        </View>

        {/* Usage */}
        <View style={styles.groupSection}>
          <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Usage (使い方)</Text>
          <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
            <View style={[styles.usageRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.usageText, { color: colors.textPrimary }]}>{data.usage}</Text>
            </View>
          </View>
        </View>

        {/* Examples */}
        {data.examples.length > 0 && (
          <View style={styles.groupSection}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Examples (例文)</Text>
            <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
              {data.examples.map((ex, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.exampleRow, { borderBottomColor: colors.divider }]}
                  onPress={() => speak(ex.ja)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exampleText}>
                    <Text style={[styles.exampleJa, { color: colors.textPrimary }]}>{ex.ja}</Text>
                    <Text style={[styles.exampleEn, { color: colors.textSecondary }]}>{ex.en}</Text>
                  </View>
                  <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    );
  }

  // Verb detail
  const verbData = (verbs as Record<string, VerbData>)[key];
  if (!verbData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textPrimary }}>Verb not found</Text>
      </View>
    );
  }

  const formTagColors: Record<KeigoForm, { bg: string; text: string }> = {
    sonkeigo: { bg: colors.sonkeigoTag, text: colors.sonkeigoTagText },
    kenjougo: { bg: colors.kenjougoTag, text: colors.kenjougoTagText },
    teineigo: { bg: colors.teineigoTag, text: colors.teineigoTagText },
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={[styles.verb, { color: colors.primary }]}>{key}</Text>
            <TouchableOpacity onPress={() => speak(key)}>
              <Ionicons name="volume-medium" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => toggleFavorite(key)}>
            <Ionicons
              name={isFavorite(key) ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorite(key) ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.reading, { color: colors.textSecondary }]}>{verbData.reading}</Text>
        <Text style={[styles.translation, { color: colors.textPrimary }]}>{verbData.translation}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>{LEVEL_LABELS[verbData.level]}</Text>
          </View>
        </View>
      </View>

      {/* Keigo Forms */}
      <View style={styles.groupSection}>
        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Keigo Forms (敬語)</Text>
        <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
          {(['sonkeigo', 'kenjougo', 'teineigo'] as KeigoForm[]).map((form) => {
            const formData = form === 'teineigo'
              ? { form: verbData.teineigo.form, reading: verbData.teineigo.reading }
              : verbData[form];
            const label = KEIGO_FORM_LABELS[form];
            const tagColor = formTagColors[form];

            return (
              <TouchableOpacity
                key={form}
                style={[styles.formRow, { borderBottomColor: colors.divider }]}
                onPress={() => speak(formData.reading)}
                activeOpacity={0.7}
              >
                <View style={styles.formLabel}>
                  <View style={[styles.formTag, { backgroundColor: tagColor.bg }]}>
                    <Text style={[styles.formTagText, { color: tagColor.text }]}>{label.ja}</Text>
                  </View>
                  <Text style={[styles.formLabelEn, { color: colors.textMuted }]}>{label.en}</Text>
                </View>
                <View style={styles.formValue}>
                  <View style={styles.formTextRow}>
                    <Text style={[styles.formText, { color: colors.textPrimary }]}>{formData.form}</Text>
                    <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
                  </View>
                  {formData.form !== formData.reading && (
                    <Text style={[styles.formReading, { color: colors.textMuted }]}>{formData.reading}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Examples */}
      {verbData.examples && verbData.examples.length > 0 && (
        <View style={styles.groupSection}>
          <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Examples (例文)</Text>
          <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
            {verbData.examples.map((ex, i) => {
              const exTagColor = formTagColors[ex.type];
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.exampleRow, { borderBottomColor: colors.divider }]}
                  onPress={() => speak(ex.ja)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exampleText}>
                    <View style={[styles.exampleTag, { backgroundColor: exTagColor.bg }]}>
                      <Text style={[styles.exampleTagText, { color: exTagColor.text }]}>
                        {KEIGO_FORM_LABELS[ex.type].ja}
                      </Text>
                    </View>
                    <Text style={[styles.exampleContext, { color: colors.textMuted }]}>{ex.context}</Text>
                    <Text style={[styles.exampleJa, { color: colors.textPrimary }]}>{ex.ja}</Text>
                    <Text style={[styles.exampleEn, { color: colors.textSecondary }]}>{ex.en}</Text>
                  </View>
                  <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  verb: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  reading: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  translation: { fontSize: fonts.sizes.lg, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  speakButton: { marginLeft: 'auto' },
  groupSection: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  groupTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.sm,
  },
  groupCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formLabel: { width: 90, alignItems: 'flex-start' },
  formTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, marginBottom: 2 },
  formTagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },
  formLabelEn: { fontSize: 10 },
  formValue: { flex: 1 },
  formTextRow: { flexDirection: 'row', alignItems: 'center' },
  formText: { fontSize: fonts.sizes.lg },
  formReading: { fontSize: fonts.sizes.sm, marginTop: 2 },
  usageRow: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  usageText: { fontSize: fonts.sizes.md, lineHeight: 24 },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exampleText: { flex: 1 },
  exampleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: 4 },
  exampleTagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  exampleContext: { fontSize: fonts.sizes.xs, fontStyle: 'italic', marginBottom: 4 },
  exampleJa: { fontSize: fonts.sizes.md },
  exampleEn: { fontSize: fonts.sizes.sm, marginTop: 2 },
});
