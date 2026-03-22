import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Fuse from 'fuse.js';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import type { RootStackParamList } from '../types/navigation';
import { VerbData, ExpressionData, BusinessLevel, LEVEL_LABELS } from '../utils/keigoTypes';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const verbEntries = Object.entries(verbs as Record<string, VerbData>);
const expressionEntries = Object.entries(expressions as Record<string, ExpressionData>);

const allSearchData = [
  ...verbEntries.map(([key, data]) => ({
    key,
    reading: data.reading,
    translation: data.translation,
    level: data.level,
    type: 'verb' as const,
    sonkeigo: data.sonkeigo.form,
    sonkeigoReading: data.sonkeigo.reading,
    kenjougo: data.kenjougo.form,
    kenjougoReading: data.kenjougo.reading,
    teineigo: data.teineigo.form,
    teineigoReading: data.teineigo.reading,
  })),
  ...expressionEntries.map(([key, data]) => ({
    key,
    reading: data.reading,
    translation: data.translation,
    level: data.level,
    type: 'expression' as const,
    sonkeigo: '',
    sonkeigoReading: '',
    kenjougo: '',
    kenjougoReading: '',
    teineigo: '',
    teineigoReading: '',
  })),
];

const KEIGO_FIELD_LABELS: Record<string, string> = {
  sonkeigo: '尊敬語',
  sonkeigoReading: '尊敬語',
  kenjougo: '謙譲語',
  kenjougoReading: '謙譲語',
  teineigo: '丁寧語',
  teineigoReading: '丁寧語',
};

const fuse = new Fuse(allSearchData, {
  keys: [
    { name: 'key', weight: 3 },
    { name: 'reading', weight: 2 },
    { name: 'translation', weight: 1.5 },
    { name: 'sonkeigo', weight: 2 },
    { name: 'sonkeigoReading', weight: 1.5 },
    { name: 'kenjougo', weight: 2 },
    { name: 'kenjougoReading', weight: 1.5 },
    { name: 'teineigo', weight: 2 },
    { name: 'teineigoReading', weight: 1.5 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  includeMatches: true,
});

interface SearchResult {
  key: string;
  reading: string;
  translation: string;
  level: BusinessLevel;
  type: 'verb' | 'expression';
  matchDetail?: string;
}

function getItemOfTheDay(): { key: string; data: VerbData; type: 'verb' } {
  const dayIndex = Math.floor(Date.now() / 86400000) % verbEntries.length;
  const [key, data] = verbEntries[dayIndex];
  return { key, data, type: 'verb' };
}

export default function HomeScreen() {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { history, loadHistory, addToHistory, removeFromHistory } = useHistoryStore();
  const { favorites, loadFavorites, toggleFavorite } = useFavoritesStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadHistory();
    loadFavorites();
  }, []);

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.trim();
    const fuseResults = fuse.search(q);
    return fuseResults.slice(0, 20).map((r) => {
      let matchDetail: string | undefined;
      if (r.matches) {
        for (const m of r.matches) {
          const label = KEIGO_FIELD_LABELS[m.key ?? ''];
          if (label && m.value) {
            matchDetail = `${label}: ${m.value}`;
            break;
          }
        }
      }
      return {
        key: r.item.key,
        reading: r.item.reading,
        translation: r.item.translation,
        level: r.item.level,
        type: r.item.type,
        matchDetail,
      };
    });
  }, [query]);

  const handleItemPress = useCallback((key: string, type: 'verb' | 'expression') => {
    addToHistory(key);
    navigation.navigate('Detail', { key, type });
  }, [navigation]);

  const itemOfTheDay = getItemOfTheDay();

  const levelTagColors: Record<BusinessLevel, { bg: string; text: string }> = {
    basic: { bg: colors.basicTag, text: colors.basicTagText },
    intermediate: { bg: colors.intermediateTag, text: colors.intermediateTagText },
    advanced: { bg: colors.advancedTag, text: colors.advancedTagText },
  };

  const renderDeleteAction = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={styles.deleteAction}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  const renderSearchItem = ({ item }: { item: SearchResult }) => {
    const tagColor = levelTagColors[item.level];
    return (
      <TouchableOpacity
        style={[styles.resultItem, { backgroundColor: colors.card }]}
        onPress={() => handleItemPress(item.key, item.type)}
        activeOpacity={0.7}
      >
        <View style={styles.resultLeft}>
          <Text style={[styles.resultVerb, { color: colors.textPrimary }]}>{item.key}</Text>
          <Text style={[styles.resultReading, { color: colors.textSecondary }]}>{item.reading}</Text>
        </View>
        <View style={styles.resultRight}>
          <Text style={[styles.resultTranslation, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.translation}
          </Text>
          {item.matchDetail && (
            <Text style={[styles.matchDetail, { color: colors.primary }]} numberOfLines={1}>
              {item.matchDetail}
            </Text>
          )}
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: item.type === 'expression' ? colors.expressionTag : colors.pillBg }]}>
              <Text style={[styles.tagText, { color: item.type === 'expression' ? colors.expressionTagText : colors.textMuted }]}>
                {item.type === 'verb' ? '動詞' : '表現'}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: tagColor.bg }]}>
              <Text style={[styles.tagText, { color: tagColor.text }]}>{LEVEL_LABELS[item.level]}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSwipeableRow = (key: string, listType: 'favorite' | 'history') => {
    const verbData = (verbs as Record<string, VerbData>)[key];
    const exprData = (expressions as Record<string, ExpressionData>)[key];
    const data = verbData || exprData;
    if (!data) return null;

    const handleSwipeDelete = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (listType === 'favorite') {
        toggleFavorite(key);
      } else {
        removeFromHistory(key);
      }
    };

    return (
      <Swipeable
        key={key + listType}
        renderRightActions={renderDeleteAction}
        onSwipeableOpen={handleSwipeDelete}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.historyItem, { backgroundColor: colors.bg }]}
          onPress={() => handleItemPress(key, verbData ? 'verb' : 'expression')}
          activeOpacity={0.6}
        >
          <View style={styles.historyLeft}>
            <Text style={[styles.historyVerb, { color: colors.textPrimary }]} numberOfLines={1}>{key}</Text>
            <Text style={[styles.historyReading, { color: colors.textMuted }]}>{data.reading}</Text>
          </View>
          <Text style={[styles.historyTranslation, { color: colors.textSecondary }]} numberOfLines={1}>
            {data.translation}
          </Text>
          {listType === 'favorite' ? (
            <Ionicons name="heart" size={16} color={colors.accent} style={{ marginLeft: 8 }} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.searchBg }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search verbs & expressions..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {query.trim() ? (
        <FlatList
          data={results}
          keyExtractor={(item, i) => item.key + item.type + i}
          renderItem={renderSearchItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No results found</Text>
          }
        />
      ) : (
        <ScrollView style={styles.homeContent}>
          {/* Item of the Day */}
          <TouchableOpacity
            style={[styles.vodCard, { backgroundColor: colors.card }]}
            onPress={() => handleItemPress(itemOfTheDay.key, 'verb')}
            activeOpacity={0.7}
          >
            <Text style={[styles.vodLabel, { color: colors.textMuted }]}>Keigo of the Day</Text>
            <Text style={[styles.vodVerb, { color: colors.primary }]}>{itemOfTheDay.key}</Text>
            <Text style={[styles.vodReading, { color: colors.textSecondary }]}>{itemOfTheDay.data.reading}</Text>
            <Text style={[styles.vodTranslation, { color: colors.textPrimary }]}>{itemOfTheDay.data.translation}</Text>
            <View style={[styles.vodKeigoColumn]}>
              <View style={[styles.vodKeigoItem, { backgroundColor: colors.sonkeigoTag }]}>
                <Text style={[styles.vodKeigoLabel, { color: colors.sonkeigoTagText }]}>尊敬語</Text>
                <Text style={[styles.vodKeigoForm, { color: colors.sonkeigoTagText }]}>{itemOfTheDay.data.sonkeigo.form}</Text>
              </View>
              <View style={[styles.vodKeigoItem, { backgroundColor: colors.kenjougoTag }]}>
                <Text style={[styles.vodKeigoLabel, { color: colors.kenjougoTagText }]}>謙譲語</Text>
                <Text style={[styles.vodKeigoForm, { color: colors.kenjougoTagText }]}>{itemOfTheDay.data.kenjougo.form}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Favorites */}
          {favorites.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Favorites</Text>
              {favorites.slice(0, 10).map((key) => renderSwipeableRow(key, 'favorite'))}
            </View>
          )}

          {/* Recent history */}
          {history.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent</Text>
              {history.slice(0, 10).map((key) => renderSwipeableRow(key, 'history'))}
            </View>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: fonts.sizes.md },
  listContent: { paddingHorizontal: spacing.md },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  resultLeft: { marginRight: spacing.md, flexShrink: 0 },
  resultVerb: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold },
  resultReading: { fontSize: fonts.sizes.sm, marginTop: 2 },
  resultRight: { flex: 1, alignItems: 'flex-end' },
  resultTranslation: { fontSize: fonts.sizes.sm, marginBottom: 2 },
  matchDetail: { fontSize: fonts.sizes.xs, fontStyle: 'italic', marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: spacing.xs },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  homeContent: { flex: 1, paddingHorizontal: spacing.md },
  vodCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  vodLabel: { fontSize: fonts.sizes.sm, marginBottom: spacing.sm },
  vodVerb: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  vodReading: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  vodTranslation: { fontSize: fonts.sizes.md, marginTop: spacing.sm },
  vodKeigoColumn: {
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  vodKeigoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.md,
  },
  vodKeigoLabel: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.semibold },
  vodKeigoForm: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold, marginTop: 2 },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  historyLeft: { marginRight: spacing.md, flexShrink: 0, maxWidth: '40%' },
  historyVerb: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  historyReading: { fontSize: fonts.sizes.xs },
  historyTranslation: { flex: 1, fontSize: fonts.sizes.sm },
  emptyText: { textAlign: 'center', marginTop: spacing.xl, fontSize: fonts.sizes.md },
  deleteAction: {
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
});
