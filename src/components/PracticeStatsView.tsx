import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { buildPracticeInsights } from '../utils/practiceInsights';
import { getAccuracyPercent, hasPositiveCount } from '../utils/statsMath';
import { buildCalendarWeeks, buildDayKey, computeStreak } from '../utils/activityCalendar';
import { getTodayKey } from '../utils/dayKey';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Volume-based calendar tiers (count of questions/cards on a day). jp colors
// the heatmap by how much was practiced, not accuracy — see the PR #2 stats
// change; accuracy stays in the selected-day detail.
const HIGH_VOLUME = 30;
const MID_VOLUME = 11;

// One day of practice activity, normalized across quiz (total) and
// flashcard (reviewed) sessions.
export interface DayCounts {
  day: string; // 'YYYY-MM-DD'
  count: number;
  correct: number;
}

export interface PracticeStatsLabels {
  countLabel: string; // 'Questions' | 'Cards'
  daysLabel: string; // 'Days' | 'Sessions'
  loadingText: string;
  errorText: string;
  retryAccessibilityLabel: string;
  emptyIcon: React.ComponentProps<typeof Ionicons>['name'];
  emptySubtitle: string;
}

interface AllTimeOverride {
  count: number;
  correct: number;
  thirdStat: { value: number; label: string };
}

interface PracticeStatsViewProps {
  sessions: DayCounts[];
  sessionsLoaded: boolean;
  sessionsLoadError: boolean;
  weights: Record<string, number>;
  weightsLoaded: boolean;
  weightsLoadError: boolean;
  onRetry: () => void;
  labels: PracticeStatsLabels;
  allTimeOverride?: AllTimeOverride;
}

export default function PracticeStatsView({
  sessions,
  sessionsLoaded,
  sessionsLoadError,
  weights,
  weightsLoaded,
  onRetry,
  labels,
  allTimeOverride,
}: PracticeStatsViewProps) {
  const colors = useColors();
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // jp weights are bare-verb and shared by quiz + flashcards, so the weakest
  // verbs are surfaced on both stats tabs.
  const insights = React.useMemo(() => buildPracticeInsights(weights), [weights]);

  // Map sessions by day (each session is already one day)
  const dailyMap = React.useMemo(() => {
    const map: Record<string, { count: number; correct: number }> = {};
    sessions.forEach(s => {
      if (!map[s.day]) map[s.day] = { count: 0, correct: 0 };
      map[s.day].count += s.count;
      map[s.day].correct += s.correct;
    });
    return map;
  }, [sessions]);

  // All-time totals
  const totalCount = React.useMemo(() => sessions.reduce((sum, s) => sum + s.count, 0), [sessions]);
  const totalCorrect = React.useMemo(() => sessions.reduce((sum, s) => sum + s.correct, 0), [sessions]);
  const allTimeCount = allTimeOverride?.count ?? totalCount;
  const allTimeCorrect = allTimeOverride?.correct ?? totalCorrect;
  const allTimeThirdStat = allTimeOverride?.thirdStat ?? { value: sessions.length, label: labels.daysLabel };

  // Today stats
  const todayStr = getTodayKey();
  const todayData = dailyMap[todayStr];

  const streak = React.useMemo(
    () => computeStreak((key) => hasPositiveCount(dailyMap[key]?.count), todayStr),
    [dailyMap, todayStr],
  );

  // Calendar
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const calendarWeeks = React.useMemo(() => buildCalendarWeeks(calYear, calMonth), [calYear, calMonth]);

  const getDayKey = (day: number) => buildDayKey(calYear, calMonth, day);

  const getDayColor = (day: number) => {
    const data = dailyMap[getDayKey(day)];
    if (!data || !hasPositiveCount(data.count)) return null;
    if (data.count >= HIGH_VOLUME) return { bg: colors.calHigh, text: colors.calHighText };
    if (data.count >= MID_VOLUME) return { bg: colors.calMid, text: colors.calMidText };
    return { bg: colors.calLow, text: colors.calLowText };
  };

  const prevMonth = () => {
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    const now = new Date();
    const next = new Date(calYear, calMonth + 1, 1);
    // Cap at the current month — paging into a guaranteed-empty future
    // month is never useful.
    if (next <= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setCalendarDate(next);
      setSelectedDay(null);
    }
  };

  const selectedData = selectedDay ? dailyMap[selectedDay] : null;
  const selectedAccuracy = selectedData ? getAccuracyPercent(selectedData.correct, selectedData.count) : null;
  const selectedDateLabel = React.useMemo(() => {
    if (!selectedDay) return null;
    const [y, m, d] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDay]);

  if (sessionsLoadError && !sessionsLoaded) {
    return (
      <View style={[styles.container, styles.loadingContainer, styles.statusContainer, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusText, { color: colors.textMuted }]}>{labels.errorText}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={labels.retryAccessibilityLabel}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!sessionsLoaded) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>{labels.loadingText}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Streak */}
      {streak > 0 && (
        <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.streakText, { color: colors.primary }]}>
            {streak} day streak
          </Text>
        </View>
      )}

      {/* All-time stats */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>All Time</Text>
      <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{allTimeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{labels.countLabel}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {getAccuracyPercent(allTimeCorrect, allTimeCount) ?? 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{allTimeThirdStat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{allTimeThirdStat.label}</Text>
          </View>
        </View>
      </View>

      {/* Today */}
      {todayData && hasPositiveCount(todayData.count) && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Today</Text>
          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{todayData.count}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{labels.countLabel}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {getAccuracyPercent(todayData.correct, todayData.count) ?? 0}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                  {todayData.correct}/{todayData.count}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Calendar */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Activity</Text>
      <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
        {/* Month navigation */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={prevMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.calendarMonth, { color: colors.textPrimary }]}>{monthName}</Text>
          <TouchableOpacity
            onPress={nextMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.calendarRow}>
          {WEEKDAYS.map(d => (
            <Text key={d} style={[styles.weekdayLabel, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        {/* Day grid */}
        {calendarWeeks.map((week, wi) => (
          <View key={wi} style={styles.calendarRow}>
            {week.map((day, di) => {
              if (day === null) {
                return <View key={di} style={styles.calendarCell} />;
              }
              const dayColor = getDayColor(day);
              const key = getDayKey(day);
              const isSelected = selectedDay === key;
              const isToday = key === todayStr;
              const dayData = dailyMap[key];
              const dayCount = dayData?.count;
              const hasActivity = hasPositiveCount(dayCount);
              const dateLabel = new Date(calYear, calMonth, day).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.calendarCell,
                    dayColor && { backgroundColor: dayColor.bg },
                    isSelected && { borderWidth: 2, borderColor: colors.primary },
                    isToday && !dayColor && { borderWidth: 1, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    if (hasActivity) setSelectedDay(isSelected ? null : key);
                  }}
                  activeOpacity={hasActivity ? 0.7 : 1}
                  accessibilityRole={hasActivity ? 'button' : 'text'}
                  accessibilityLabel={
                    hasActivity
                      ? `${dateLabel}: ${dayCount} ${labels.countLabel.toLowerCase()}, ${dayData?.correct ?? 0} correct`
                      : `${dateLabel}: no activity`
                  }
                  accessibilityState={{ selected: isSelected, disabled: !hasActivity }}
                >
                  <Text style={[
                    styles.calendarDay,
                    { color: dayColor ? dayColor.text : colors.textMuted },
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Selected day detail */}
        {selectedDay && selectedData && selectedAccuracy !== null && (
          <View style={[styles.selectedDetail, { borderTopColor: colors.divider }]}>
            <Text style={[styles.selectedDate, { color: colors.textPrimary }]}>
              {selectedDateLabel}
            </Text>
            <Text style={[styles.selectedStat, { color: colors.textSecondary }]}>
              {selectedData.correct}/{selectedData.count} · {selectedAccuracy}% accuracy
            </Text>
          </View>
        )}
      </View>

      {/* Legend — volume tiers */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.calHigh }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>30+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.calMid }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>11–29</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.calLow }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>1–10</Text>
        </View>
      </View>

      {/* Weakest verbs — jp's only weight-derived insight (bare-verb, shared
          across quiz + flashcards) */}
      {weightsLoaded && insights.weakVerbs.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Weak Areas</Text>
          <View style={[styles.insightCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.insightTitle, { color: colors.textPrimary }]}>Weakest verbs</Text>
            {insights.weakVerbs.map(item => (
              <View key={item.verb} style={styles.insightRow}>
                <Text style={[styles.insightLabel, { color: colors.textPrimary }]}>
                  {item.verb} · {item.reading}
                </Text>
                <Text style={[styles.insightValue, { color: colors.primary }]}>{item.weight.toFixed(1)}x</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Empty state */}
      {allTimeCount === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name={labels.emptyIcon} size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No stats yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {labels.emptySubtitle}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  statusContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusText: {
    fontSize: fonts.sizes.md,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  content: { padding: spacing.lg, paddingBottom: 40 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  streakEmoji: { fontSize: 24 },
  streakText: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  statsCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold },
  statLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calendarMonth: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  calendarRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.xs,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    margin: 2,
  },
  calendarDay: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
  },
  selectedDetail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  selectedDate: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  selectedStat: {
    fontSize: fonts.sizes.sm,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: fonts.sizes.xs,
  },
  insightCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  insightTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.sm,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  insightLabel: {
    flex: 1,
    fontSize: fonts.sizes.sm,
  },
  insightValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fonts.sizes.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
