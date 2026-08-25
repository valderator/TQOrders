import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppShell from './src/AppShell';
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { hydrate } from './src/data/store';
import { colors, typography } from './src/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    hydrate()
      .then(() => setReady(true))
      .catch(err => setError(err?.message || String(err)));
  }, []);

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Startup error</Text>
          <Text style={typography.muted}>{error}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <AppShell />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.bg,
    padding: 24,
  },
  errorTitle: { fontSize: 18, fontWeight: '800', color: colors.danger },
});
