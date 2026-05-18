import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable,
  FlatList, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '../lib/theme';
import { useStore } from '../lib/store';
import type { LogEntry } from '../lib/supabase';

const LOG_ICONS: Record<LogEntry['type'], string> = {
  agent_step: '◈',
  tool_call: '⚙',
  memory_write: '◉',
  error: '✕',
};

const LOG_COLORS: Record<LogEntry['type'], string> = {
  agent_step: colors.teal,
  tool_call: colors.accent,
  memory_write: colors.purple,
  error: '#E05252',
};

function LogRow({ entry }: { entry: LogEntry }) {
  const color = LOG_COLORS[entry.type] ?? colors.inkFaint;
  const icon = LOG_ICONS[entry.type] ?? '·';
  return (
    <View style={styles.row}>
      <Text style={[styles.rowIcon, { color }]}>{icon}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowText}>{entry.summary}</Text>
        <Text style={styles.rowTime}>
          {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function LogsDrawer() {
  const insets = useSafeAreaInsets();
  const { logsOpen, logs, setLogsOpen } = useStore();
  const translateX = useRef(new Animated.Value(340)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: logsOpen ? 0 : 340,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
    }).start();
  }, [logsOpen]);

  if (!logsOpen) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scrim */}
      <TouchableWithoutFeedback onPress={() => setLogsOpen(false)}>
        <Animated.View
          style={[styles.scrim, { opacity: translateX.interpolate({ inputRange: [0, 340], outputRange: [1, 0] }) }]}
          pointerEvents={logsOpen ? 'auto' : 'none'}
        />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, transform: [{ translateX }] }]}>
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View>
            <Text style={styles.drawerTitle}>Agent Logs</Text>
            <Text style={styles.drawerSub}>{logs.length} entries</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={() => setLogsOpen(false)}>
            <Ionicons name="close" size={20} color={colors.ink2} />
          </Pressable>
        </View>

        {/* Type legend */}
        <View style={styles.legend}>
          {Object.entries(LOG_ICONS).map(([type, icon]) => (
            <View key={type} style={styles.legendItem}>
              <Text style={[styles.legendIcon, { color: LOG_COLORS[type as LogEntry['type']] }]}>{icon}</Text>
              <Text style={styles.legendLabel}>{type.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>

        {/* Log list */}
        <FlatList
          data={logs}
          keyExtractor={l => l.id}
          renderItem={({ item }) => <LogRow entry={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No agent activity yet.</Text>
              <Text style={styles.emptyText}>Start a conversation to see logs.</Text>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 320,
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderLeftColor: colors.rule,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  drawerTitle: { fontSize: font.lg, fontWeight: '800', color: colors.ink },
  drawerSub: { fontSize: font.xs, color: colors.inkFaint, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendIcon: { fontSize: 12 },
  legendLabel: { fontSize: 10, color: colors.inkFaint, fontWeight: '500' },
  list: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.rule,
  },
  rowIcon: { fontSize: 14, marginTop: 1 },
  rowBody: { flex: 1, gap: 2 },
  rowText: { fontSize: font.xs, color: colors.ink, lineHeight: 16 },
  rowTime: { fontSize: 10, color: colors.inkFaint },
  empty: { paddingTop: 40, alignItems: 'center', gap: 4 },
  emptyText: { fontSize: font.sm, color: colors.inkFaint },
});
