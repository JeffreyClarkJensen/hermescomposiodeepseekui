import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../../lib/theme';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!isLoaded) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      }
    } catch (e: any) {
      setError(e.errors?.[0]?.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 40 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>◈</Text>
      <Text style={styles.title}>Cortex</Text>
      <Text style={styles.sub}>Sign in to continue</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.inkFaint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.inkFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.btn} onPress={onSignIn} disabled={loading}>
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.btnText}>Sign in</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', paddingHorizontal: spacing.lg,
  },
  logo:  { fontSize: 48, color: colors.accent, marginBottom: spacing.sm },
  title: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub:   { fontSize: font.sm, color: colors.inkFaint, marginTop: 4, marginBottom: 40 },
  form:  { width: '100%', maxWidth: 360, gap: spacing.md },
  input: {
    height: 50, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.rule,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: font.sm, color: colors.ink,
  },
  error: { fontSize: font.xs, color: '#C0392B', textAlign: 'center' },
  btn: {
    height: 50, borderRadius: radius.lg,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: font.md },
});
