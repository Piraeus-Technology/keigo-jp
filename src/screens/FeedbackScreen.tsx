import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import { resetLearningData } from '../utils/resetLearningData';
import type { MoreStackParamList } from '../types/navigation';

export const APP_STORE_URL =
  'https://apps.apple.com/app/apple-store/id6787575609?action=write-review';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.piraeus.keigojp';
const PLAY_STORE_APP_URL = 'market://details?id=com.piraeus.keigojp';

export default function FeedbackScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList, 'MoreMain'>>();
  const { isDark, toggleTheme, autoTTS, toggleAutoTTS } = useThemeStore();
  const [isResetting, setIsResetting] = useState(false);

  const storeName = Platform.OS === 'android' ? 'Google Play' : 'App Store';
  const shareUrl = Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
  const installedVersion = Application.nativeApplicationVersion;
  const installedBuild = Application.nativeBuildVersion;
  const versionLabel = installedVersion
    ? `KeiGo JP v${installedVersion}${installedBuild ? ` (${installedBuild})` : ''}`
    : 'KeiGo JP version unavailable';

  const handleRateApp = async () => {
    const url = Platform.OS === 'android' ? PLAY_STORE_APP_URL : APP_STORE_URL;
    try {
      await Linking.openURL(url);
    } catch {
      if (Platform.OS === 'android') {
        try {
          await Linking.openURL(PLAY_STORE_URL);
          return;
        } catch {
          // Fall through to the platform-correct error below.
        }
      }
      Alert.alert(`Could Not Open ${storeName}`, `Please try opening KeiGo JP in ${storeName} directly.`);
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('KeiGo JP Feedback');
    const url = `mailto:contact@piraeus.app?subject=${subject}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'No Email App',
        'You can send feedback directly to contact@piraeus.app'
      );
    });
  };

  const performLearningDataReset = async () => {
    setIsResetting(true);
    try {
      const cleared = await resetLearningData();
      if (cleared) {
        Alert.alert('Learning Data Reset', 'Your learning data has been permanently deleted.');
      } else {
        Alert.alert(
          'Reset Incomplete',
          'Some learning data could not be deleted. Please try again. Your preferences were not changed.',
        );
      }
    } catch {
      Alert.alert(
        'Reset Incomplete',
        'Some learning data could not be deleted. Please try again. Your preferences were not changed.',
      );
    } finally {
      setIsResetting(false);
    }
  };

  const handleLearningDataReset = () => {
    if (isResetting) return;
    Alert.alert(
      'Reset Learning Data?',
      'This permanently deletes your favorites, recent history, quiz and flashcard statistics, practice sessions, and spaced-repetition progress.\n\nYour practice settings, dark mode, and auto-play audio preference will remain. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Learning Data',
          style: 'destructive',
          onPress: () => {
            void performLearningDataReset();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Settings section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Settings</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              accessibilityLabel="Dark Mode"
            />
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="volume-medium" size={20} color={colors.textSecondary} />
            <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Auto-Play Audio</Text>
            <Switch
              value={autoTTS}
              onValueChange={toggleAutoTTS}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              accessibilityLabel="Auto-Play Audio"
            />
          </View>
        </View>

        {/* Statistics section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Statistics</Text>
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Stats')}
          activeOpacity={0.7}
        >
          <Text style={styles.rowEmoji}>📊</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Quiz Stats</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Streak, accuracy, activity calendar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('FlashcardStats')}
          activeOpacity={0.7}
        >
          <Text style={styles.rowEmoji}>🗂️</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Flashcard Stats</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Cards reviewed, accuracy, weak verbs</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Learning data */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Learning Data</Text>
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.errorText }]}
          onPress={handleLearningDataReset}
          activeOpacity={0.7}
          disabled={isResetting}
          accessibilityRole="button"
          accessibilityLabel="Reset Learning Data"
          accessibilityState={{ disabled: isResetting }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.errorText} style={{ marginRight: spacing.md }} />
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.errorText }]}>
              {isResetting ? 'Resetting Learning Data…' : 'Reset Learning Data'}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Deletes progress, favorites, and history; keeps settings
            </Text>
          </View>
        </TouchableOpacity>

        {/* Support section */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Support</Text>
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={handleSendEmail}
          activeOpacity={0.7}
        >
          <Text style={styles.rowEmoji}>💬</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Send Feedback</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Bug reports, suggestions, missing content</Text>
          </View>
          <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Rate */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={handleRateApp}
          activeOpacity={0.7}
        >
          <Text style={styles.rowEmoji}>⭐</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Enjoying KeiGo JP?</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Rate us on {storeName}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={async () => {
            try {
              await Share.share({
                message: `Check out KeiGo JP — master Japanese business keigo! ${shareUrl}`,
                url: shareUrl,
              });
            } catch {
              Alert.alert('Could Not Share', 'Please try again.');
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.rowEmoji}>🔗</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Share KeiGo JP</Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Tell a friend about the app</Text>
          </View>
          <Ionicons name="share-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.card }]}
          onPress={() => {
            Linking.openURL('https://piraeus-technology.github.io/keigo-jp/').catch(() => {
              Alert.alert('Could Not Open Privacy Policy', 'Please try again when you are online.');
            });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} style={{ marginRight: spacing.md }} />
          <Text style={[styles.linkText, { color: colors.textPrimary }]}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>
          {versionLabel}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  settingsCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  settingLabel: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  rowEmoji: { fontSize: 32, marginRight: spacing.md },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  rowSubtitle: { fontSize: fonts.sizes.sm, marginTop: 2 },
  linkText: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  version: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
