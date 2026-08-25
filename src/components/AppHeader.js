import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const STATUS_MAP = {
  syncing: { label: 'Syncing', tone: colors.accent, icon: 'sync-outline' },
  synced: { label: 'Synced', tone: colors.success, icon: 'cloud-done-outline' },
  offline: { label: 'Offline', tone: colors.warning, icon: 'cloud-offline-outline' },
  error: { label: 'Sync issue', tone: colors.danger, icon: 'warning-outline' },
  'local-only': { label: 'Local mode', tone: colors.textMuted, icon: 'save-outline' },
  'signed-out': { label: 'Not synced', tone: colors.textMuted, icon: 'cloud-offline-outline' },
  idle: { label: 'Idle', tone: colors.textMuted, icon: 'time-outline' },
};

export function SyncPill({ onPress }) {
  const { syncState } = useData();
  const info = STATUS_MAP[syncState.status] || STATUS_MAP.idle;
  const pending = syncState.status === 'local-only' ? 0 : syncState.pendingCount || 0;
  return (
    <Pressable onPress={onPress} style={styles.pill}>
      <Ionicons name={info.icon} size={13} color={info.tone} />
      <Text style={[styles.pillText, { color: info.tone }]}>
        {info.label}
        {pending > 0 ? ` · ${pending}` : ''}
      </Text>
    </Pressable>
  );
}

export default function AppHeader({ title, subtitle, right, onBack }) {
  const { user, isAdmin } = useAuth();
  const { refresh } = useData();

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : (
        <Image source={require('../../assets/turquoise-logo.png')} style={styles.logo} resizeMode="contain" />
      )}
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle || `${user?.full_name || 'Guest'} · ${isAdmin ? 'Admin' : 'Staff'}`}
        </Text>
      </View>
      <View style={styles.rightBlock}>
        {right}
        <SyncPill onPress={refresh} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  logo: { width: 36, height: 36, borderRadius: radius.sm },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  rightBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  pillText: { fontSize: 11, fontWeight: '700' },
});
