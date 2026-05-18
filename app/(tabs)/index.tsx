import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Pressable, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font, spacing } from '../../lib/theme';
import { useStore } from '../../lib/store';
import { sendMessageStream, type ChatMessage } from '../../lib/hermes';
import type { Message } from '../../lib/supabase';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { messages, isThinking, addMessage, setThinking, setLogsOpen, addLog, appendToLastMessage, setStreamingId } = useStore();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, created_at: new Date().toISOString() };
    addMessage(userMsg);
    setThinking(true);

    const assistantId = (Date.now() + 1).toString();
    addMessage({ id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() });
    setStreamingId(assistantId);

    const history: ChatMessage[] = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    sendMessageStream(
      history,
      (token) => {
        appendToLastMessage(token);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
      },
      () => {
        setThinking(false);
        setStreamingId(null);
        addLog({ id: Date.now().toString(), type: 'agent_step', summary: `Replied to: "${text.slice(0, 40)}…"`, created_at: new Date().toISOString() });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      },
      (e) => {
        appendToLastMessage(`⚠ ${e.message}`);
        setThinking(false);
        setStreamingId(null);
      },
    );
  }, [input, isThinking, messages]);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>Cortex</Text>
          <Text style={styles.headerSub}>● live · 0.6s latency</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setLogsOpen(true)}>
            <Ionicons name="list" size={20} color={colors.ink2} />
            <Text style={styles.iconBtnLabel}>Logs</Text>
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink2} />
          </Pressable>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyChat />}
        renderItem={({ item }) => <ChatBubble msg={item} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Thinking indicator */}
      {isThinking && (
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.thinkingText}>Cortex is thinking…</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 16 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Cortex…"
          placeholderTextColor={colors.inkFaint}
          multiline
          onSubmitEditing={submit}
          returnKeyType="send"
          onKeyPress={({ nativeEvent }: any) => {
            if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) submit();
          }}
        />
        <Pressable
          onPress={submit}
          style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.35 }]}
        >
          <Ionicons name="arrow-up" size={18} color={colors.bg} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
      {!isUser && <Text style={styles.bubbleSender}>Cortex</Text>}
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
      <Text style={styles.bubbleTime}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
    </View>
  );
}

function EmptyChat() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>◈</Text>
      <Text style={styles.emptyTitle}>Good morning.</Text>
      <Text style={styles.emptySub}>Hold the mic to talk, or type below.</Text>
      <View style={styles.suggestions}>
        {['Summarise my notes', 'Add Sam Chen to CRM', 'What tools are active?'].map(s => (
          <View key={s} style={styles.suggestionChip}>
            <Text style={styles.suggestionText}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: font.xl, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  headerSub:   { fontSize: font.xs, color: colors.teal, fontWeight: '600', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  iconBtn: { alignItems: 'center', gap: 2 },
  iconBtnLabel: { fontSize: 9, color: colors.ink2, fontWeight: '600' },

  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 20 },

  bubble: {
    maxWidth: '80%', padding: spacing.md,
    borderRadius: radius.lg, gap: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.ink,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.rule,
    borderBottomLeftRadius: 4,
  },
  bubbleSender: { fontSize: font.xs, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 },
  bubbleText: { fontSize: font.sm, color: colors.ink, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  bubbleTime: { fontSize: 10, color: colors.inkFaint, alignSelf: 'flex-end' },

  thinking: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  thinkingText: { fontSize: font.sm, color: colors.inkFaint, fontStyle: 'italic' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
    paddingRight: 160,
    borderTopWidth: 1, borderTopColor: colors.rule,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.rule,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: font.sm, color: colors.ink,
  },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyIcon:  { fontSize: 40, color: colors.accent },
  emptyTitle: { fontSize: font.xxl, fontWeight: '800', color: colors.ink },
  emptySub:   { fontSize: font.sm, color: colors.inkFaint },
  suggestions: { marginTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  suggestionChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.rule,
    backgroundColor: colors.card,
  },
  suggestionText: { fontSize: font.sm, color: colors.ink2 },
});
