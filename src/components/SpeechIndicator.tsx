import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../utils/theme';
import {
  isSpeechPlaying,
  onSpeechEnd,
  onSpeechPlaybackStart,
  onSpeechStart,
} from '../utils/speech';

// Longest a pronunciation should visibly linger if the TTS callbacks never fire
// (e.g. no Japanese voice installed, where Android's TTS is a silent no-op).
const START_TIMEOUT_MS = 2500;
const SPEAKING_POLL_MS = 1000;
const MIN_VISIBLE_MS = 1200;
const LINGER_AFTER_END_MS = 400;
const HEADER_HEIGHT = 56;
const HEADER_GAP = 8;

/**
 * Global, app-level feedback shown whenever speech is triggered. A speak
 * control's only effect is audio, which is invisible and unavailable on many
 * devices; this pill guarantees every tap produces a clear on-screen response.
 * Mounted once at the app root; purely presentational (pointerEvents="none").
 */
export default function SpeechIndicator() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleSince = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let lifecycle = 0;
    const clearTimer = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const hide = () => {
      hideTimer.current = null;
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) visibleSince.current = null;
        },
      );
    };
    const scheduleHide = (ms: number) => {
      clearTimer();
      hideTimer.current = setTimeout(hide, ms);
    };
    const schedulePlaybackCheck = (ms: number, expectedLifecycle: number) => {
      clearTimer();
      hideTimer.current = setTimeout(async () => {
        hideTimer.current = null;
        const speaking = await isSpeechPlaying();
        if (!active || lifecycle !== expectedLifecycle) return;
        if (speaking) {
          schedulePlaybackCheck(SPEAKING_POLL_MS, expectedLifecycle);
        } else {
          hide();
        }
      }, ms);
    };

    const unsubStart = onSpeechStart((t) => {
      lifecycle += 1;
      setText(t);
      visibleSince.current = Date.now();
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      // Covers engines that never invoke onStart (for example, when a
      // Japanese voice is unavailable) without cutting off longer speech.
      schedulePlaybackCheck(START_TIMEOUT_MS, lifecycle);
    });
    const unsubPlaybackStart = onSpeechPlaybackStart(() => {
      lifecycle += 1;
      if (visibleSince.current === null) visibleSince.current = Date.now();
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      schedulePlaybackCheck(START_TIMEOUT_MS, lifecycle);
    });
    const unsubEnd = onSpeechEnd(() => {
      if (visibleSince.current === null) return;
      lifecycle += 1;
      const elapsed = Date.now() - visibleSince.current;
      scheduleHide(Math.max(MIN_VISIBLE_MS - elapsed, LINGER_AFTER_END_MS));
    });

    return () => {
      active = false;
      lifecycle += 1;
      unsubStart();
      unsubPlaybackStart();
      unsubEnd();
      clearTimer();
      opacity.stopAnimation();
    };
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, { opacity, top: insets.top + HEADER_HEIGHT + HEADER_GAP }]}
    >
      <View style={[styles.pill, { backgroundColor: colors.speechIndicatorBg }]}>
        <Ionicons name="volume-high" size={16} color={colors.speechIndicatorText} />
        <Text numberOfLines={1} style={[styles.text, { color: colors.speechIndicatorText }]}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 1,
  },
});
