import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { speak } from '../utils/speech';

type Props = {
  text: string;
  color: string;
  size?: number;
  activeColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
};

// How long the icon stays in its "active" state after a tap when the TTS
// callbacks don't report completion (e.g. no Japanese voice installed).
const ACTIVE_MS = 1200;

/**
 * Icon speak button that always gives an immediate, visible + tactile response
 * on tap — a haptic tick, a quick pulse, and an active-icon state — so the
 * control is never a silent no-op even when audio can't play on the device.
 */
export default function SpeakButton({
  text,
  color,
  size = 22,
  activeColor,
  backgroundColor,
  style,
  hitSlop = 8,
  accessibilityLabel,
}: Props) {
  const [active, setActive] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onPress = () => {
    Haptics.selectionAsync().catch(() => undefined);
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), ACTIVE_MS);
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    speak(text);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Play pronunciation of ${text}`}
      style={[styles.touchTarget, backgroundColor ? { backgroundColor } : null, style]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={active ? 'volume-high' : 'volume-medium'}
          size={size}
          color={active ? activeColor ?? color : color}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
