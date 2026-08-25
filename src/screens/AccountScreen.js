import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ConfirmDialog, StatTile } from '../components/ui';
import { colors, money, radius, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { resetLocalCache } from '../data/store';
import { formatDateTime, formatDuration, minutesBetween, toDateKey } from '../lib/date';

export default function AccountScreen() {
  const { user, isAdmin, signOut, localMode } = useAuth();
  const { syncState, history, shifts, refresh, api } = useData();
  const [confirm, setConfirm] = useState({ visible: false });

  const mine = useMemo(() => {
    const myOrders = history.filter(entry => entry.served_by === user?.id);
    const myShifts = shifts.filter(shift => shift.user_id === user?.id);
    const today = toDateKey(new Date());
    return {
      orders: myOrders.length,
      revenue: myOrders.reduce((sum, entry) => sum + Number(entry.total_price || 0), 0),
      todayOrders: myOrders.filter(entry => (entry.day || toDateKey(entry.started_at)) === today).length,
      hours:
        myShifts.reduce((sum, shift) => sum + (shift.clock_out ? minutesBetween(shift.clock_in, shift.clock_out) : 0), 0) /
        60,
    };
  }, [history, shifts, user]);

  const activeShift = api.getActiveShift(user?.id);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user)}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{user?.full_name || user?.email}</Text>
            <Text style={typography.tiny}>{user?.email}</Text>
            <View style={styles.badgeRow}>
              <Badge label={isAdmin ? 'Administrator' : 'Employee'} tone={isAdmin ? 'accent' : 'brand'} />
              {activeShift ? <Badge label={`On shift ${formatDuration(activeShift.clock_in)}`} tone="success" /> : null}
            </View>
          </View>
        </Card>

        <View style={styles.statRow}>
          <StatTile label="Orders today" value={String(mine.todayOrders)} icon="today-outline" />
          <StatTile label="Orders total" value={String(mine.orders)} icon="receipt-outline" tone="accent" />
          <StatTile label="Revenue" value={money(mine.revenue)} icon="cash-outline" tone="success" />
          <StatTile label="Hours worked" value={mine.hours.toFixed(1)} icon="hourglass-outline" tone="warning" />
        </View>

        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.section}>Data & sync</Text>
          <Row label="Mode" value={localMode ? 'Local device only' : 'Supabase cloud'} />
          <Row label="Status" value={syncState.status} />
          {localMode ? null : <Row label="Pending changes" value={String(syncState.pendingCount || 0)} />}
          <Row label="Last sync" value={syncState.lastSyncedAt ? formatDateTime(syncState.lastSyncedAt) : '—'} />
          {syncState.error ? <Text style={styles.error}>{syncState.error}</Text> : null}
          <Button title="Sync now" icon="sync-outline" variant="outline" onPress={refresh} />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={typography.section}>Permissions</Text>
          <Text style={typography.muted}>
            {isAdmin
              ? 'You can edit the menu, floors, tables, team roles, shifts and history.'
              : 'You can take and manage orders, clock in/out and read history and calendars. Menu, tables, team and history edits are admin-only.'}
          </Text>
        </Card>

        <Button
          title="Sign out"
          icon="log-out-outline"
          variant="danger"
          onPress={() =>
            setConfirm({
              visible: true,
              tone: 'danger',
              title: 'Sign out',
              message: 'Unsynced changes stay on this device and upload the next time you sign in.',
              confirmText: 'Sign out',
              onConfirm: () => {
                setConfirm({ visible: false });
                signOut();
              },
            })
          }
        />

        {isAdmin ? (
          <Button
            title="Reset local cache"
            icon="refresh-outline"
            variant="ghost"
            onPress={() =>
              setConfirm({
                visible: true,
                tone: 'danger',
                title: 'Reset local cache',
                message:
                  'Clears everything stored on this device. Cloud data is re-downloaded on the next sync; unsynced changes are lost.',
                confirmText: 'Reset',
                onConfirm: async () => {
                  setConfirm({ visible: false });
                  await resetLocalCache();
                  api.ensureSeed();
                  refresh();
                },
              })
            }
          />
        ) : null}
      </ScrollView>
      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={typography.muted}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function initials(profile) {
  const source = profile?.full_name || profile?.email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.brand },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  statRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  error: { fontSize: 12, color: colors.danger },
});
