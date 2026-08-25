import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Field, Input } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { signIn, localMode } = useAuth();
  const [email, setEmail] = useState(localMode ? 'admin@local' : '');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, secret);
    } catch (err) {
      setError(err?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brand}>
          <Image source={require('../../assets/turquoise-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Turquoise</Text>
          <Text style={typography.muted}>Bakery & Brunch · Floor service</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@turquoise.ro"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </Field>
          <Field label={localMode ? 'PIN' : 'Password'}>
            <Input
              value={secret}
              onChangeText={setSecret}
              placeholder={localMode ? '4 digit PIN' : '••••••••'}
              secureTextEntry
              autoComplete={localMode ? 'off' : 'current-password'}
              onSubmitEditing={submit}
            />
          </Field>
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Button title="Sign in" variant="primary" size="lg" onPress={submit} loading={busy} full />
        </Card>

        {localMode ? (
          <Card style={styles.hint}>
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.brand} />
              <Text style={styles.hintTitle}>Local mode</Text>
            </View>
            <Text style={typography.muted}>
              No Supabase keys detected, so the app runs fully offline on this device. Demo accounts:
            </Text>
            <Text style={styles.mono}>admin@local · PIN 1234 (admin)</Text>
            <Text style={styles.mono}>staff@local · PIN 1111 (employee)</Text>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  brand: { alignItems: 'center', gap: 6 },
  logo: { width: 76, height: 76, marginBottom: spacing.sm },
  title: { ...typography.display, fontSize: 30 },
  card: { width: '100%', maxWidth: 420, gap: spacing.md },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  hint: { width: '100%', maxWidth: 420, gap: 6 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  mono: { fontSize: 12, color: colors.brand, fontWeight: '700' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
});
