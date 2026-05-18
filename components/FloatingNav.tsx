import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { useStore } from '../lib/store';

const B = 30;    // small button diameter
const M = 64;    // mic diameter
const R = 80;    // arc radius (center-to-center, mic → button)

// Square container that fits mic at bottom-right + arc buttons in upper-left quadrant
const PAD = 6;
const C = Math.ceil(M / 2 + R + B / 2 + PAD);   // ~131

// Mic center within the container (sits at the bottom-right corner of C×C box)
const MCX = C - M / 2;
const MCY = C - M / 2;

// 4 buttons arcing from straight-up (270°) to straight-left (180°), 30° steps
// Using standard Math angles where 0°=right, 270°=up (y-down screen coords)
const GRID = [
  { route: 'memory',    icon: 'brain',         isMCI: true,  angleDeg: 270 },
  { route: 'crm',       icon: 'people-outline', isMCI: false, angleDeg: 240 },
  { route: 'tools',     icon: 'construct',      isMCI: false, angleDeg: 210 },
  { route: 'analytics', icon: 'bar-chart',      isMCI: false, angleDeg: 180 },
] as const;

type Props = { activeRoute: string; navigate: (r: string) => void };

export default function FloatingNav({ activeRoute, navigate }: Props) {
  const insets = useSafeAreaInsets();
  const { isRecording, setRecording } = useStore();
  const scale = useRef(new Animated.Value(1)).current;
  const ring  = useRef(new Animated.Value(0)).current;

  const startPulse = () =>
    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  const stopPulse = () => { ring.stopAnimation(); ring.setValue(0); };
  const onIn  = () => { setRecording(true);  if (activeRoute !== 'index') navigate('index'); Animated.spring(scale, { toValue: 1.08, useNativeDriver: true }).start(); startPulse(); };
  const onOut = () => { setRecording(false); Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start(); stopPulse(); };

  const ringScale   = ring.interpolate({ inputRange: [0,1], outputRange: [1, 1.5] });
  const ringOpacity = ring.interpolate({ inputRange: [0,1], outputRange: [0.4, 0] });

  return (
    <View
      style={{ position: 'absolute', bottom: insets.bottom + 20, right: 20 }}
      pointerEvents="box-none"
    >
      <View style={{ width: C, height: C }}>
        {/* Arc nav buttons */}
        {GRID.map(item => {
          const rad = (item.angleDeg * Math.PI) / 180;
          const bx = MCX + R * Math.cos(rad);
          const by = MCY + R * Math.sin(rad);
          const active = activeRoute === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => navigate(item.route)}
              style={[
                styles.navBtn,
                {
                  width: B, height: B, borderRadius: B / 2,
                  top:  by - B / 2,
                  left: bx - B / 2,
                  backgroundColor: active ? colors.ink : colors.bg,
                  borderColor: active ? colors.ink : 'rgba(42,34,28,0.25)',
                },
              ]}
            >
              {item.isMCI
                ? <MaterialCommunityIcons name={item.icon as any} size={B * 0.5} color={active ? colors.bg : colors.ink} />
                : <Ionicons name={item.icon as any} size={B * 0.5} color={active ? colors.bg : colors.ink} />
              }
            </Pressable>
          );
        })}

        {/* Mic pulse ring */}
        {isRecording && (
          <Animated.View style={[
            styles.navBtn,
            {
              width: M, height: M, borderRadius: M / 2,
              top:  MCY - M / 2,
              left: MCX - M / 2,
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderColor: colors.teal,
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]} />
        )}

        {/* Mic button */}
        <Animated.View
          style={{
            position: 'absolute',
            top:  MCY - M / 2,
            left: MCX - M / 2,
            transform: [{ scale }],
          }}
        >
          <Pressable
            style={[styles.mic, { width: M, height: M, borderRadius: M / 2 }]}
            onPressIn={onIn}
            onPressOut={onOut}
          >
            <Ionicons name="mic" size={26} color={colors.bg} />
          </Pressable>
        </Animated.View>
      </View>

      <Text style={styles.holdLabel}>HOLD TO TALK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  navBtn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    gap: 1,
  },
  label: {
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  mic: {
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 12,
  },
  holdLabel: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 8,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 1.2,
  },
});
