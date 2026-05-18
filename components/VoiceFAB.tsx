import React, { useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../lib/theme';
import { useStore } from '../lib/store';

export default function VoiceFAB() {
  const { isRecording, setRecording } = useStore();
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    ring.stopAnimation();
    ring.setValue(0);
  };

  const handlePressIn = () => {
    setRecording(true);
    Animated.spring(scale, { toValue: 1.15, useNativeDriver: true }).start();
    startPulse();
  };

  const handlePressOut = () => {
    setRecording(false);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    stopPulse();
  };

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={styles.container} pointerEvents="box-none">
      {isRecording && (
        <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      )}
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          style={[styles.fab, isRecording && styles.fabActive]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={24} color={colors.white} />
        </Pressable>
      </Animated.View>
      {isRecording && (
        <Text style={styles.label}>Listening…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ring: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.teal,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
  },
  label: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
