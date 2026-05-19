import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius } from '../../lib/theme';
import { useStore } from '../../lib/store';

type ToolItem = { name: string; title: string; description: string };

const MCP_URL = (() => {
  try { return process.env.EXPO_PUBLIC_MCP_URL || 'http://localhost:3333/api/mcp'; }
  catch { return 'http://localhost:3333/api/mcp'; }
})();
const COMPOSIO_DASHBOARD = 'https://app.composio.dev';
const ENV_KEY = (() => {
  try { return process.env.EXPO_PUBLIC_COMPOSIO_MCP_KEY; } catch { return ''; }
})();

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const { composioKey, setComposioKey } = useStore();
  const [consumerKey, setConsumerKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'welcome' | 'enter-key' | 'connected'>(
    ENV_KEY && ENV_KEY.startsWith('ck_') ? 'enter-key' : 'welcome'
  );

  const fetchTools = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    let sessionId = '';
    try {
      // Initialize MCP session
      const initRes = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'x-consumer-api-key': key,
        },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'jarvis', version: '1.0' } },
        }),
      });
      if (!initRes.ok) throw new Error('MCP init failed (' + initRes.status + ')');
      sessionId = initRes.headers.get('mcp-session-id') ?? '';
      if (!sessionId) throw new Error('No session ID from MCP');

      // List tools
      const listRes = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'x-consumer-api-key': key,
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      });
      if (!listRes.ok) throw new Error('MCP list failed (' + listRes.status + ')');

      const text = await listRes.text();
      // Parse SSE response for the tools/list result
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.result?.tools) {
            setTools(data.result.tools);
            break;
          }
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  // Auto-connect from env
  useEffect(() => {
    if (ENV_KEY && ENV_KEY.startsWith('ck_')) {
      setSavedKey(ENV_KEY);
      setStep('connected');
      fetchTools(ENV_KEY);
    }
  }, [fetchTools]);

  const handleConnect = useCallback(async () => {
    if (!consumerKey.trim() || !consumerKey.startsWith('ck_')) return;
    const key = consumerKey.trim();
    setConsumerKey('');
    setSavedKey(key);
    setStep('connected');
    await fetchTools(key);
  }, [consumerKey, fetchTools]);

  const handleDisconnect = useCallback(() => {
    setSavedKey(null);
    setTools([]);
    setError('');
    setStep('welcome');
    setConsumerKey('');
  }, []);

  const openUrl = (url: string) => () => Linking.openURL(url);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tools</Text>
          <Text style={styles.sub}>
            {step === 'welcome' && 'Connect your tools via Composio MCP'}
            {step === 'enter-key' && 'Enter your key to connect'}
            {step === 'connected' && (loading ? 'Connecting...' : String(tools.length) + ' tools available')}
          </Text>
        </View>
        {step === 'connected' && (
          <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        )}
      </View>

      {/* ── Keys section ── */}
      {step !== 'connected' && (
        <View style={styles.keysSection}>
          <View style={styles.keysHeader}>
            <Ionicons name="key-outline" size={16} color={colors.ink2} />
            <Text style={styles.keysTitle}>Your Keys</Text>
            {composioKey ? <View style={styles.keysSavedBadge}><Text style={styles.keysSavedText}>Saved</Text></View> : null}
          </View>
          <View style={styles.keysRow}>
            <TextInput
              style={styles.keysInput}
              value={consumerKey || composioKey}
              onChangeText={setConsumerKey}
              placeholder={composioKey ? 'ck_' + composioKey.slice(3, 6) + '...' : 'Paste your Composio consumer key (ck_...)'}
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            {composioKey ? (
              <Pressable style={styles.keysRemoveBtn} onPress={() => { setComposioKey(''); setConsumerKey(''); }}>
                <Ionicons name="trash-outline" size={18} color="#C0392B" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.keysSaveBtn, (!consumerKey || !consumerKey.startsWith('ck_')) && { opacity: 0.4 }]}
                onPress={() => { setComposioKey(consumerKey.trim()); setConsumerKey(''); }}
                disabled={!consumerKey || !consumerKey.startsWith('ck_')}
              >
                <Text style={styles.keysSaveText}>Save</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.keysHint}>
            {composioKey
              ? 'Composio key is saved. Your agent will use it to access connected tools.'
              : 'Your consumer key from composio whoami. Saved to your account — sent securely with each request.'}
          </Text>
        </View>
      )}

      {step === 'welcome' && (
        <View style={styles.stepContainer}>
          <View style={styles.heroCard}>
            <Ionicons name="puzzle-outline" size={36} color={colors.ink} />
            <Text style={styles.heroTitle}>Composio MCP</Text>
            <Text style={styles.heroSub}>
              200+ tools through a single MCP endpoint. Connect once, and your Hermes agent can use Gmail, GitHub, Slack, Notion, and more.
            </Text>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Install the Composio CLI</Text>
              <Text style={styles.stepDesc}>
                Run this in your terminal to get started:
              </Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText}>curl -fsSL https://composio.dev/install | bash</Text>
              </View>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Find your MCP key</Text>
              <Text style={styles.stepDesc}>
                Run <Text style={styles.codeInline}>composio whoami</Text> to get your consumer API key (starts with <Text style={styles.codeInline}>ck_</Text>).
              </Text>
            </View>
          </View>

          <Pressable style={styles.actionBtn} onPress={() => setStep('enter-key')}>
            <Text style={styles.actionBtnText}>I have my key →</Text>
          </Pressable>
        </View>
      )}

      {step === 'enter-key' && (
        <View style={styles.stepContainer}>
          <View style={styles.heroCard}>
            <Ionicons name="key-outline" size={36} color={colors.ink} />
            <Text style={styles.heroTitle}>Enter your MCP key</Text>
            <Text style={styles.heroSub}>
              Paste your consumer API key from <Text style={styles.codeInline}>composio whoami</Text>
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Consumer API Key</Text>
          <View style={styles.keyRow}>
            <TextInput
              style={styles.keyInput}
              value={consumerKey}
              onChangeText={setConsumerKey}
              placeholder="ck_..."
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Pressable
              style={[styles.connectBtn, (!consumerKey || loading) && { opacity: 0.4 }]}
              onPress={handleConnect}
              disabled={!consumerKey || loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={colors.bg} />
                : <Text style={styles.connectBtnText}>Connect</Text>
              }
            </Pressable>
          </View>

          <Pressable style={styles.skipBtn} onPress={() => setStep('welcome')}>
            <Text style={styles.skipBtnText}>← Back</Text>
          </Pressable>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {step === 'connected' && loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Connecting to Composio MCP...</Text>
        </View>
      )}

      {step === 'connected' && !loading && tools.length > 0 && (
        <FlatList
          data={tools}
          keyExtractor={(t) => t.name}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.connectedHeader}>
              <Ionicons name="checkmark-circle" size={20} color={colors.teal} />
              <Text style={styles.connectedText}>
                MCP Connected · {tools.length} meta tools
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.toolCard}>
              <View style={styles.toolIcon}>
                <Ionicons name="puzzle-outline" size={20} color={colors.purple} />
              </View>
              <View style={styles.toolInfo}>
                <Text style={styles.toolName}>{item.title ?? item.name}</Text>
                <Text style={styles.toolDesc} numberOfLines={2}>
                  {item.description?.split('\n')[0] ?? ''}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.mcpInfo}>
              <Ionicons name="server-outline" size={16} color={colors.teal} />
              <Text style={styles.mcpInfoText}>
                Your Hermes agent connects to this MCP endpoint to access 200+ tools.
                Configure the MCP URL and consumer key in your Hermes backend settings.
              </Text>
            </View>
          }
        />
      )}

      {step === 'connected' && !loading && tools.length === 0 && !error && (
        <View style={styles.stepContainer}>
          <View style={styles.heroCard}>
            <Ionicons name="apps-outline" size={36} color={colors.ink2} />
            <Text style={styles.heroTitle}>Connected</Text>
            <Text style={styles.heroSub}>
              MCP endpoint authenticated. No tools listed yet — try connecting apps via the Composio CLI.
            </Text>
          </View>
        </View>
      )}

      {step === 'connected' && !loading && tools.length === 0 && error && (
        <View style={styles.stepContainer}>
          <View style={styles.heroCard}>
            <Ionicons name="warning-outline" size={36} color={colors.accent} />
            <Text style={styles.heroTitle}>Connection issue</Text>
            <Text style={styles.heroSub}>{error}</Text>
          </View>
          <Pressable style={styles.actionBtn} onPress={() => savedKey && fetchTools(savedKey)}>
            <Ionicons name="refresh-outline" size={18} color={colors.bg} />
            <Text style={styles.actionBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.rule,
  },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: font.xs, color: colors.inkFaint, marginTop: 2 },
  disconnectBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#C0392B44' },
  disconnectText: { fontSize: font.xs, fontWeight: '600', color: '#C0392B' },

  stepContainer: { padding: spacing.lg, gap: spacing.lg },
  heroCard: {
    alignItems: 'center', gap: spacing.sm,
    padding: spacing.xl, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule,
  },
  heroTitle: { fontSize: font.xl, fontWeight: '800', color: colors.ink },
  heroSub: { fontSize: font.sm, color: colors.inkFaint, textAlign: 'center', lineHeight: 20 },

  stepCard: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule,
  },
  stepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: colors.bg, fontWeight: '800', fontSize: font.sm },
  stepBody: { flex: 1, gap: spacing.sm },
  stepTitle: { fontSize: font.md, fontWeight: '700', color: colors.ink },
  stepDesc: { fontSize: font.xs, color: colors.inkFaint, lineHeight: 18 },

  codeBlock: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  codeText: { fontSize: 11, color: colors.ink2, fontFamily: 'monospace' },
  codeInline: { fontFamily: 'monospace', fontWeight: '600', color: colors.ink2 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  actionBtnText: { color: colors.bg, fontWeight: '700', fontSize: font.sm },

  skipBtn: { alignSelf: 'center', padding: spacing.sm },
  skipBtnText: { fontSize: font.sm, color: colors.accent, fontWeight: '600' },

  sectionLabel: { fontSize: font.xs, fontWeight: '700', color: colors.ink2, letterSpacing: 0.5, textTransform: 'uppercase' },
  keyRow: { flexDirection: 'row', gap: spacing.sm },
  keyInput: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.card, paddingHorizontal: spacing.md, fontSize: font.sm, color: colors.ink },
  connectBtn: { height: 48, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  connectBtnText: { color: colors.bg, fontWeight: '700', fontSize: font.sm },

  errorBox: { padding: spacing.md, borderRadius: radius.md, backgroundColor: '#C0392B15', borderWidth: 1, borderColor: '#C0392B33' },
  errorBoxText: { fontSize: font.xs, color: '#C0392B', textAlign: 'center' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: font.sm, color: colors.inkFaint },

  connectedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md },
  connectedText: { fontSize: font.sm, fontWeight: '700', color: colors.teal },
  list: { padding: spacing.md, gap: spacing.sm },
  toolCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule,
  },
  toolIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purpleLight },
  toolInfo: { flex: 1 },
  toolName: { fontSize: font.sm, fontWeight: '700', color: colors.ink },
  toolDesc: { fontSize: font.xs, color: colors.inkFaint, marginTop: 1, lineHeight: 16 },
  mcpInfo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.tealLight + '22', marginTop: spacing.sm,
  },
  mcpInfoText: { fontSize: font.xs, color: colors.ink2, flex: 1, lineHeight: 16 },

  // Keys section
  keysSection: {
    padding: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.rule,
  },
  keysHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  keysTitle: { fontSize: font.sm, fontWeight: '700', color: colors.ink, flex: 1 },
  keysSavedBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.tealLight },
  keysSavedText: { fontSize: 10, fontWeight: '700', color: colors.teal },
  keysRow: { flexDirection: 'row', gap: spacing.sm },
  keysInput: {
    flex: 1, height: 44, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.bg,
    paddingHorizontal: spacing.md, fontSize: font.xs, color: colors.ink,
  },
  keysSaveBtn: {
    height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  keysSaveText: { color: colors.bg, fontWeight: '700', fontSize: font.sm },
  keysRemoveBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    borderWidth: 1, borderColor: '#C0392B44', alignItems: 'center', justifyContent: 'center',
  },
  keysHint: { fontSize: 10, color: colors.inkFaint, marginTop: spacing.xs, lineHeight: 14 },
});
