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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import verbs from '../data/verbs.json';
import expressions from '../data/expressions.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import type { SearchStackParamList } from '../types/navigation';
import { VerbData, ExpressionData, BusinessLevel, LEVEL_LABELS } from '../utils/keigoTypes';
import { getDailyItemIndex, millisecondsUntilNextLocalDay } from '../utils/dailyItem';
import { getVerbFormData } from '../utils/gradableVerbs';
import { searchKeigo } from '../utils/search';
import type { SearchResult } from '../utils/search';

type NavProp = NativeStackNavigationProp<SearchStackParamList>;

const verbEntries = Object.entries(verbs as Record<string, VerbData>);

function getItemOfTheDay(date: Date): { key: string; data: VerbData; type: 'verb' } {
  const dayIndex = getDailyItemIndex(date, verbEntries.length);
  const [key, data] = verbEntries[dayIndex];
  return { key, data, type: 'verb' };
}

export default function HomeScreen() {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { history, loadHistory, addToHistory, removeFromHistory } = useHistoryStore();
  const { favorites, loadFavorites, toggleFavorite } = useFavoritesStore();
  const [query, setQuery] = useState('');
  const [itemOfTheDay, setItemOfTheDay] = useState(() => getItemOfTheDay(new Date()));
  const dailySonkeigo = getVerbFormData(itemOfTheDay.data, 'sonkeigo');
  const dailyKenjougo = getVerbFormData(itemOfTheDay.data, 'kenjougo');

  useEffect(() => {
    loadHistory();
    loadFavorites();
  }, [loadHistory, loadFavorites]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextDay = () => {
      const now = new Date();
      timer = setTimeout(() => {
        setItemOfTheDay(getItemOfTheDay(new Date()));
        scheduleNextDay();
      }, millisecondsUntilNextLocalDay(now) + 50);
    };
    scheduleNextDay();
    return () => clearTimeout(timer);
  }, []);

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    return searchKeigo(query);
  }, [query]);

  const handleItemPress = useCallback((key: string, type: 'verb' | 'expression') => {
    addToHistory(key);
    navigation.navigate('Detail', { key, type });
  }, [addToHistory, navigation]);

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
        accessibilityRole="button"
        accessibilityLabel={`${item.key}, ${item.reading}, ${item.translation}`}
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
          accessibilityRole="button"
          accessibilityLabel={`${listType === 'favorite' ? 'Favorite' : 'Recent'}: ${key}, ${data.reading}, ${data.translation}`}
          accessibilityHint="Opens details. Swipe left to remove."
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
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
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
            accessibilityRole="button"
            accessibilityLabel={`Keigo of the Day: ${itemOfTheDay.key}, ${itemOfTheDay.data.reading}, ${itemOfTheDay.data.translation}`}
          >
            <Text style={[styles.vodLabel, { color: colors.textMuted }]}>Keigo of the Day</Text>
            <Text style={[styles.vodVerb, { color: colors.primary }]}>{itemOfTheDay.key}</Text>
            <Text style={[styles.vodReading, { color: colors.textSecondary }]}>{itemOfTheDay.data.reading}</Text>
            <Text style={[styles.vodTranslation, { color: colors.textPrimary }]}>{itemOfTheDay.data.translation}</Text>
            <View style={[styles.vodKeigoColumn]}>
              <View style={[styles.vodKeigoItem, { backgroundColor: colors.sonkeigoTag }]}>
                <Text style={[styles.vodKeigoLabel, { color: colors.sonkeigoTagText }]}>尊敬語</Text>
                <Text style={[styles.vodKeigoForm, { color: colors.sonkeigoTagText }]}>
                  {dailySonkeigo.availability === 'present' ? dailySonkeigo.form : ''}
                </Text>
              </View>
              <View style={[styles.vodKeigoItem, { backgroundColor: colors.kenjougoTag }]}>
                <Text style={[styles.vodKeigoLabel, { color: colors.kenjougoTagText }]}>謙譲語</Text>
                <Text style={[styles.vodKeigoForm, { color: colors.kenjougoTagText }]}>
                  {dailyKenjougo.availability === 'present' ? dailyKenjougo.form : ''}
                </Text>
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
