import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  active: boolean;
};

const CATEGORY_COLORS: Record<string, string> = {
  Research: colors.teal,
  Memory:   colors.purple,
  CRM:      colors.accent,
  Calendar: '#E0A052',
  Comms:    '#5298E0',
  Knowledge:colors.teal,
  Dev:      colors.inkFaint,
};

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('tools').select('*').order('name');
    setTools(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string, current: boolean) => {
    setTools(ts => ts.map(t => t.id === id ? { ...t, active: !current } : t));
    await supabase.from('tools').update({ active: !current }).eq('id', id);
  };

  const activeCount = tools.filter(t => t.active).length;

  if (loading) return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tools</Text>
          <Text style={styles.sub}>{activeCount} of {tools.length} active</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activeCount} ON</Text>
        </View>
      </View>

      <FlatList
        data={tools}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, item.active && styles.cardActive]}>
            <View style={[styles.iconWrap, { backgroundColor: item.active ? (CATEGORY_COLORS[item.category] + '22') : colors.cardAlt }]}>
              <Ionicons name={item.icon as any} size={20} color={item.active ? CATEGORY_COLORS[item.category] : colors.inkFaint} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardRow}>
                <Text style={[styles.cardName, item.active && styles.cardNameActive]}>{item.name}</Text>
                <View style={[styles.catChip, { backgroundColor: CATEGORY_COLORS[item.category] + '22' }]}>
                  <Text style={[styles.catText, { color: CATEGORY_COLORS[item.category] }]}>{item.category}</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
            <Switch
              value={item.active}
              onValueChange={() => toggle(item.id, item.active)}
              trackColor={{ false: colors.rule, true: colors.tealLight }}
              thumbColor={item.active ? colors.teal : colors.inkFaint}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tools configured</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub:   { fontSize: font.xs, color: colors.inkFaint, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.tealLight },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.teal },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule,
  },
  cardActive: { borderColor: colors.teal + '44' },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardName: { fontSize: font.sm, fontWeight: '700', color: colors.ink2 },
  cardNameActive: { color: colors.ink },
  cardDesc: { fontSize: font.xs, color: colors.inkFaint, lineHeight: 16 },
  catChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  catText: { fontSize: 10, fontWeight: '600' },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: font.sm, color: colors.inkFaint },
  cardAlt: { backgroundColor: colors.cardAlt },
});
