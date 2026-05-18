import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

type Thread = {
  id: string;
  title: string;
  tag: string | null;
  atoms: number;
  updated_at: string;
};

const TAG_COLORS: Record<string, string> = {
  System:   colors.accent,
  Sales:    colors.teal,
  Research: colors.purple,
  Content:  '#E0A052',
  CRM:      '#5298E0',
  Personal: '#E05298',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MemoryScreen() {
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('memory_threads')
      .select('*')
      .order('updated_at', { ascending: false });
    setThreads(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteThread = async (id: string) => {
    setThreads(ts => ts.filter(t => t.id !== id));
    await supabase.from('memory_threads').delete().eq('id', id);
  };

  const filtered = threads.filter(t =>
    !query || t.title.toLowerCase().includes(query.toLowerCase())
  );

  const totalAtoms = threads.reduce((a, t) => a + (t.atoms ?? 0), 0);

  if (loading) return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Memory</Text>
        <Text style={styles.sub}>{threads.length} threads · {totalAtoms} atoms</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.inkFaint} />
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search memory…"
          placeholderTextColor={colors.inkFaint}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.inkFaint} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>◉</Text>
            <Text style={styles.emptyTitle}>No memory yet</Text>
            <Text style={styles.emptyText}>Chat with Cortex to build your knowledge base.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOpen = selected === item.id;
          const tagColor = TAG_COLORS[item.tag ?? ''] ?? colors.inkFaint;
          return (
            <Pressable
              style={[styles.card, isOpen && styles.cardOpen]}
              onPress={() => setSelected(isOpen ? null : item.id)}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardMeta}>
                  {item.tag && (
                    <View style={[styles.tag, { backgroundColor: tagColor + '22' }]}>
                      <Text style={[styles.tagText, { color: tagColor }]}>{item.tag}</Text>
                    </View>
                  )}
                  <Text style={styles.updated}>{timeAgo(item.updated_at)}</Text>
                </View>
                <View style={styles.atomsBadge}>
                  <Text style={styles.atomsText}>{item.atoms ?? 0}</Text>
                  <Text style={styles.atomsLabel}>atoms</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {isOpen && (
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionBtn}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.teal} />
                    <Text style={[styles.actionText, { color: colors.teal }]}>Ask</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => deleteThread(item.id)}>
                    <Ionicons name="trash-outline" size={14} color='#E05252' />
                    <Text style={[styles.actionText, { color: '#E05252' }]}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        }}
      />
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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    margin: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.rule,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  search: { flex: 1, fontSize: font.sm, color: colors.ink },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule, gap: spacing.xs,
  },
  cardOpen: { borderColor: colors.accent + '44' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  tagText: { fontSize: 10, fontWeight: '700' },
  updated: { fontSize: 10, color: colors.inkFaint },
  atomsBadge: { alignItems: 'center' },
  atomsText: { fontSize: font.sm, fontWeight: '800', color: colors.ink },
  atomsLabel: { fontSize: 9, color: colors.inkFaint },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink },
  cardActions: {
    flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.rule, marginTop: spacing.xs,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: font.xs, color: colors.ink2, fontWeight: '600' },
  empty: { paddingTop: 80, alignItems: 'center', gap: spacing.sm },
  emptyIcon: { fontSize: 36, color: colors.purple },
  emptyTitle: { fontSize: font.lg, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: font.sm, color: colors.inkFaint, textAlign: 'center', paddingHorizontal: spacing.xl },
});
