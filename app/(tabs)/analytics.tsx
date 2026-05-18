import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing, radius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

type Stats = {
  messagesTotal: number;
  messagesToday: number;
  logsTotal: number;
  logsToday: number;
  contactsTotal: number;
  contactsClosed: number;
  threadsTotal: number;
  atomsTotal: number;
  toolsActive: number;
};

type LogTypeCounts = { type: string; count: number }[];

function BarChart({ rows, title, max }: { rows: { label: string; value: number; color: string }[]; title: string; max: number }) {
  return (
    <View style={styles.chart}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.bars}>
        {rows.map(row => (
          <View key={row.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{row.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: max > 0 ? `${(row.value / max) * 100}%` : '0%', backgroundColor: row.color }]} />
            </View>
            <Text style={styles.barValue}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);
  const [logCounts, setLogCounts] = useState<LogTypeCounts>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const [
      { count: messagesTotal },
      { count: messagesToday },
      { count: logsTotal },
      { count: logsToday },
      { count: contactsTotal },
      { count: contactsClosed },
      { count: threadsTotal },
      { data: atomsData },
      { count: toolsActive },
    ] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
      supabase.from('logs').select('*', { count: 'exact', head: true }),
      supabase.from('logs').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('stage', 'Closed'),
      supabase.from('memory_threads').select('*', { count: 'exact', head: true }),
      supabase.from('memory_threads').select('atoms'),
      supabase.from('tools').select('*', { count: 'exact', head: true }).eq('active', true),
    ]);

    const atomsTotal = (atomsData ?? []).reduce((s: number, r: any) => s + (r.atoms ?? 0), 0);

    setStats({
      messagesTotal: messagesTotal ?? 0,
      messagesToday: messagesToday ?? 0,
      logsTotal: logsTotal ?? 0,
      logsToday: logsToday ?? 0,
      contactsTotal: contactsTotal ?? 0,
      contactsClosed: contactsClosed ?? 0,
      threadsTotal: threadsTotal ?? 0,
      atomsTotal,
      toolsActive: toolsActive ?? 0,
    });

    // log type breakdown
    const { data: logRows } = await supabase.from('logs').select('type');
    const counts: Record<string, number> = {};
    for (const r of logRows ?? []) counts[r.type] = (counts[r.type] ?? 0) + 1;
    setLogCounts(Object.entries(counts).map(([type, count]) => ({ type, count })));

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );

  if (!stats) return null;

  const TYPE_COLORS: Record<string, string> = {
    agent_step:   colors.teal,
    tool_call:    colors.accent,
    memory_write: colors.purple,
    error:        '#E05252',
  };

  const logMax = Math.max(...logCounts.map(l => l.count), 1);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.sub}>Live · updated now</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Messages Today', value: String(stats.messagesToday) },
            { label: 'Total Messages',  value: String(stats.messagesTotal) },
            { label: 'Agent Steps',     value: String(stats.logsToday) },
            { label: 'Active Tools',    value: String(stats.toolsActive) },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Log type breakdown */}
        {logCounts.length > 0 && (
          <BarChart
            title="Agent Activity by Type"
            max={logMax}
            rows={logCounts.map(l => ({
              label: l.type.replace('_', ' '),
              value: l.count,
              color: TYPE_COLORS[l.type] ?? colors.inkFaint,
            }))}
          />
        )}

        {/* Memory health */}
        <View style={styles.chart}>
          <Text style={styles.chartTitle}>Memory Health</Text>
          <View style={styles.healthRow}>
            <View style={styles.healthItem}>
              <Text style={styles.healthValue}>{stats.atomsTotal}</Text>
              <Text style={styles.healthLabel}>Atoms</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthItem}>
              <Text style={styles.healthValue}>{stats.threadsTotal}</Text>
              <Text style={styles.healthLabel}>Threads</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthItem}>
              <Text style={[styles.healthValue, { color: colors.teal }]}>{stats.contactsTotal}</Text>
              <Text style={styles.healthLabel}>Contacts</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthItem}>
              <Text style={[styles.healthValue, { color: '#4CAF50' }]}>{stats.contactsClosed}</Text>
              <Text style={styles.healthLabel}>Closed</Text>
            </View>
          </View>
        </View>

        {/* Empty state hint */}
        {stats.messagesTotal === 0 && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>Start chatting with Cortex to see analytics populate in real time.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: font.xs, color: colors.inkFaint, marginTop: 2 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.rule, padding: spacing.md, gap: 3,
  },
  statValue: { fontSize: font.xxl, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  statLabel: { fontSize: font.xs, color: colors.ink2, fontWeight: '600' },
  chart: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule, padding: spacing.md, gap: spacing.sm },
  chartTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink },
  bars: { gap: spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 80, fontSize: 11, color: colors.ink2, textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 28, fontSize: 11, color: colors.inkFaint, textAlign: 'right' },
  healthRow: { flexDirection: 'row', alignItems: 'center' },
  healthItem: { flex: 1, alignItems: 'center', gap: 3 },
  healthDivider: { width: 1, height: 40, backgroundColor: colors.rule },
  healthValue: { fontSize: font.xl, fontWeight: '800', color: colors.ink },
  healthLabel: { fontSize: 10, color: colors.inkFaint },
  hint: { padding: spacing.lg, alignItems: 'center' },
  hintText: { fontSize: font.sm, color: colors.inkFaint, textAlign: 'center', lineHeight: 20 },
});
