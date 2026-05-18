import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

type Stage = 'Lead' | 'Contacted' | 'Demo' | 'Proposal' | 'Closed';

type Contact = {
  id: string;
  name: string;
  company: string | null;
  value: string | null;
  stage: Stage;
  last_contact: string | null;
  created_at: string;
};

const STAGES: Stage[] = ['Lead', 'Contacted', 'Demo', 'Proposal', 'Closed'];

const STAGE_COLORS: Record<Stage, string> = {
  Lead:      colors.inkFaint,
  Contacted: colors.teal,
  Demo:      '#E0A052',
  Proposal:  colors.accent,
  Closed:    '#4CAF50',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(ts: string | null) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AVATAR_COLORS = [colors.teal, colors.accent, colors.purple, '#E0A052', '#5298E0', '#4CAF50'];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xfffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function ContactCard({ contact, onMove }: { contact: Contact; onMove: (id: string, dir: 1 | -1) => void }) {
  const stageIdx = STAGES.indexOf(contact.stage);
  const color = avatarColor(contact.id);
  return (
    <View style={styles.contactCard}>
      <View style={styles.contactTop}>
        <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
          <Text style={[styles.avatarText, { color }]}>{initials(contact.name)}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={styles.contactCompany}>{contact.company ?? '—'}</Text>
        </View>
        {contact.value ? <Text style={styles.contactValue}>{contact.value}</Text> : null}
      </View>
      <View style={styles.contactBottom}>
        <Text style={styles.contactTime}>Last: {timeAgo(contact.last_contact)}</Text>
        <View style={styles.contactActions}>
          {stageIdx > 0 && (
            <Pressable onPress={() => onMove(contact.id, -1)} style={styles.moveBtn}>
              <Ionicons name="chevron-back" size={14} color={colors.ink2} />
            </Pressable>
          )}
          {stageIdx < STAGES.length - 1 && (
            <Pressable onPress={() => onMove(contact.id, 1)} style={[styles.moveBtn, styles.moveBtnForward]}>
              <Text style={styles.moveBtnText}>→ {STAGES[stageIdx + 1]}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function CRMScreen() {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const load = useCallback(async () => {
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    setContacts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveContact = async (id: string, dir: 1 | -1) => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;
    const idx = STAGES.indexOf(contact.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    setContacts(cs => cs.map(c => c.id === id ? { ...c, stage: next } : c));
    await supabase.from('contacts').update({ stage: next }).eq('id', id);
  };

  const closedValue = contacts
    .filter(c => c.stage === 'Closed' && c.value)
    .reduce((sum, c) => sum + parseInt((c.value ?? '0').replace(/\D/g, '') || '0'), 0);

  if (loading) return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>CRM</Text>
          <Text style={styles.sub}>
            {contacts.length} contacts{closedValue > 0 ? ` · $${(closedValue / 1000).toFixed(1)}k closed` : ''}
          </Text>
        </View>
        <View style={styles.viewToggle}>
          <Pressable style={[styles.toggleBtn, view === 'kanban' && styles.toggleBtnActive]} onPress={() => setView('kanban')}>
            <Ionicons name="grid-outline" size={16} color={view === 'kanban' ? colors.accent : colors.inkFaint} />
          </Pressable>
          <Pressable style={[styles.toggleBtn, view === 'list' && styles.toggleBtnActive]} onPress={() => setView('list')}>
            <Ionicons name="list-outline" size={16} color={view === 'list' ? colors.accent : colors.inkFaint} />
          </Pressable>
        </View>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>◈</Text>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptyText}>Tell Cortex to add a contact to get started.</Text>
        </View>
      ) : view === 'kanban' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kanban}>
          {STAGES.map(stage => {
            const col = contacts.filter(c => c.stage === stage);
            return (
              <View key={stage} style={styles.column}>
                <View style={styles.colHeader}>
                  <View style={[styles.colDot, { backgroundColor: STAGE_COLORS[stage] }]} />
                  <Text style={styles.colTitle}>{stage}</Text>
                  <Text style={styles.colCount}>{col.length}</Text>
                </View>
                {col.map(c => <ContactCard key={c.id} contact={c} onMove={moveContact} />)}
                {col.length === 0 && (
                  <View style={styles.emptyCol}>
                    <Text style={styles.emptyColText}>Empty</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.listView}
          renderItem={({ item }) => <ContactCard contact={item} onMove={moveContact} />}
        />
      )}
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
  sub: { fontSize: font.xs, color: colors.inkFaint, marginTop: 2 },
  viewToggle: { flexDirection: 'row', gap: 4, backgroundColor: colors.card, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.rule },
  toggleBtn: { padding: 6, borderRadius: radius.sm - 2 },
  toggleBtnActive: { backgroundColor: colors.bg },
  kanban: { padding: spacing.md, gap: spacing.sm, alignItems: 'flex-start' },
  column: { width: 220, gap: spacing.sm },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.xs },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink, flex: 1 },
  colCount: { fontSize: 11, color: colors.inkFaint, fontWeight: '600' },
  emptyCol: { height: 60, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  emptyColText: { fontSize: font.xs, color: colors.inkFaint },
  listView: { padding: spacing.md, gap: spacing.sm },
  contactCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.rule, padding: spacing.md, gap: spacing.sm },
  contactTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.xs, fontWeight: '800' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: font.sm, fontWeight: '700', color: colors.ink },
  contactCompany: { fontSize: font.xs, color: colors.inkFaint },
  contactValue: { fontSize: font.sm, fontWeight: '700', color: colors.teal },
  contactBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contactTime: { fontSize: 10, color: colors.inkFaint },
  contactActions: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  moveBtn: { padding: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.rule },
  moveBtnForward: { backgroundColor: colors.accentLight, borderColor: colors.accent + '44', paddingHorizontal: 8 },
  moveBtnText: { fontSize: 10, color: colors.accent, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyIcon: { fontSize: 36, color: colors.accent },
  emptyTitle: { fontSize: font.lg, fontWeight: '800', color: colors.ink },
  emptyText: { fontSize: font.sm, color: colors.inkFaint, textAlign: 'center', paddingHorizontal: spacing.xl },
});
