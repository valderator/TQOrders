import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Input, StatTile } from '../components/ui';
import { colors, money, radius, spacing, typography } from '../theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDuration, formatTime, fromDateKey } from '../lib/date';

export default function HistoryScreen() {
  const { historyByDay, api } = useData();
  const { isAdmin } = useAuth();
  const [openDay, setOpenDay] = useState(null);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState({ visible: false });

  const days = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return historyByDay;
    return historyByDay
      .map(day => ({
        ...day,
        entries: day.entries.filter(entry => {
          const haystack = [
            entry.table_name,
            entry.served_by_name,
            entry.order_note,
            ...(entry.items || []).map(item => item.name),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter(day => day.entries.length > 0);
  }, [historyByDay, search]);

  const totals = useMemo(() => {
    const total = days.reduce((sum, day) => sum + day.total, 0);
    const orders = days.reduce((sum, day) => sum + day.entries.length, 0);
    return { total, orders, average: orders ? total / orders : 0 };
  }, [days]);

  if (openDay) {
    const day = historyByDay.find(item => item.day === openDay);
    return <DayDetail day={day} onBack={() => setOpenDay(null)} />;
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statRow}>
          <StatTile label="Revenue" value={money(totals.total)} icon="trending-up-outline" tone="success" />
          <StatTile label="Orders" value={String(totals.orders)} icon="receipt-outline" />
          <StatTile label="Average" value={money(totals.average)} icon="analytics-outline" tone="accent" />
        </View>

        <View style={styles.searchRow}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search table, product or waiter…"
            style={{ flex: 1 }}
          />
          {isAdmin ? (
            <Button
              title="Clear"
              icon="trash-outline"
              variant="danger"
              onPress={() =>
                setConfirm({
                  visible: true,
                  tone: 'danger',
                  title: 'Clear all history',
                  message: 'Every archived order will be permanently deleted for all devices.',
                  confirmText: 'Delete everything',
                  onConfirm: () => {
                    api.clearHistory();
                    setConfirm({ visible: false });
                  },
                })
              }
            />
          ) : null}
        </View>

        {days.length === 0 ? (
          <EmptyState icon="time-outline" title="No orders yet" message="Finished orders show up here, grouped per day." />
        ) : (
          days.map(day => (
            <Pressable key={day.day} onPress={() => setOpenDay(day.day)}>
              <Card style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayIcon}>
                    <Text style={styles.dayNumber}>{fromDateKey(day.day).getDate()}</Text>
                    <Text style={styles.dayMonth}>
                      {fromDateKey(day.day).toLocaleDateString(undefined, { month: 'short' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.dayTitle}>{formatDate(fromDateKey(day.day))}</Text>
                    <View style={styles.badgeRow}>
                      <Badge label={`${day.orders} orders`} tone="neutral" />
                      <Badge label={`${day.items} items`} tone="accent" />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.dayTotal}>{money(day.total)}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </View>
  );
}

function DayDetail({ day, onBack }) {
  const { api } = useData();
  const { isAdmin } = useAuth();
  const [expanded, setExpanded] = useState([]);
  const [confirm, setConfirm] = useState({ visible: false });

  const breakdown = useMemo(() => api.dayBreakdown(day?.entries || []), [day, api]);
  const peak = Math.max(...breakdown.hours, 1);

  if (!day) {
    return <EmptyState icon="calendar-outline" title="Day not found" action={<Button title="Back" onPress={onBack} />} />;
  }

  const toggle = id => setExpanded(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));

  return (
    <View style={styles.root}>
      <View style={styles.detailBar}>
        <IconButton icon="chevron-back" onPress={onBack} />
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle}>{formatDate(fromDateKey(day.day))}</Text>
          <Text style={typography.tiny}>Daily breakdown</Text>
        </View>
        <Text style={styles.dayTotal}>{money(breakdown.total)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statRow}>
          <StatTile label="Orders" value={String(breakdown.orders)} icon="receipt-outline" />
          <StatTile label="Average ticket" value={money(breakdown.average)} icon="pricetag-outline" tone="accent" />
          <StatTile
            label="Items sold"
            value={String(breakdown.items.reduce((sum, item) => sum + item.quantity, 0))}
            icon="cube-outline"
            tone="success"
          />
        </View>

        <Card style={{ gap: spacing.md }}>
          <Text style={typography.section}>Revenue by hour</Text>
          <View style={styles.chart}>
            {breakdown.hours.map((value, hour) => (
              <View key={hour} style={styles.chartCol}>
                <View style={[styles.bar, { height: Math.max(2, (value / peak) * 90) }]} />
                {hour % 4 === 0 ? <Text style={styles.chartLabel}>{hour}</Text> : <Text style={styles.chartLabel} />}
              </View>
            ))}
          </View>
        </Card>

        <BreakdownList title="Top products" rows={breakdown.items} icon="fast-food-outline" />
        <BreakdownList title="By category" rows={breakdown.categories} icon="grid-outline" />
        <BreakdownList
          title="By waiter"
          rows={breakdown.staff.map(row => ({ name: row.name, quantity: row.orders, total: row.total }))}
          icon="people-outline"
          unit="orders"
        />

        <Text style={typography.section}>Orders</Text>
        {day.entries.map(entry => (
          <Card key={entry.id} style={{ gap: spacing.sm, padding: spacing.md }}>
            <View style={styles.rowBetween}>
              <View style={{ gap: 2 }}>
                <Text style={styles.entryTitle}>{entry.table_name}</Text>
                <Text style={typography.tiny}>
                  {formatTime(entry.started_at)} → {formatTime(entry.finished_at)} ·{' '}
                  {formatDuration(entry.started_at, entry.finished_at)}
                </Text>
              </View>
              <Text style={styles.entryTotal}>{money(entry.total_price)}</Text>
            </View>
            <View style={styles.badgeRow}>
              <Badge label={entry.served_by_name || 'Unknown'} tone="brand" icon="person-outline" />
              <Badge label={entry.payment_method || 'cash'} tone="neutral" icon="card-outline" />
            </View>
            {entry.order_note ? <Text style={styles.entryNote}>“{entry.order_note}”</Text> : null}
            <Pressable onPress={() => toggle(entry.id)} style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {expanded.includes(entry.id) ? 'Hide' : 'Show'} {(entry.items || []).length} items
              </Text>
              <Ionicons
                name={expanded.includes(entry.id) ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.brand}
              />
            </Pressable>
            {expanded.includes(entry.id)
              ? (entry.items || []).map(item => (
                  <View key={`${entry.id}-${item.id}`} style={styles.subItem}>
                    <Text style={typography.body}>
                      {item.quantity}× {item.name}
                    </Text>
                    <Text style={typography.muted}>{money(item.price * item.quantity)}</Text>
                  </View>
                ))
              : null}
            {isAdmin ? (
              <Button
                title="Delete order"
                icon="trash-outline"
                variant="ghost"
                size="sm"
                onPress={() =>
                  setConfirm({
                    visible: true,
                    tone: 'danger',
                    title: 'Delete order',
                    message: `Remove the ${entry.table_name} order of ${money(entry.total_price)} from history?`,
                    confirmText: 'Delete',
                    onConfirm: () => {
                      api.deleteHistoryEntry(entry.id);
                      setConfirm({ visible: false });
                    },
                  })
                }
              />
            ) : null}
          </Card>
        ))}
      </ScrollView>
      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </View>
  );
}

function BreakdownList({ title, rows, icon, unit = 'pcs' }) {
  if (!rows || rows.length === 0) return null;
  const max = Math.max(...rows.map(row => row.total), 1);
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.rowBetween}>
        <Text style={typography.section}>{title}</Text>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
      </View>
      {rows.slice(0, 8).map(row => (
        <View key={row.name} style={{ gap: 4 }}>
          <View style={styles.rowBetween}>
            <Text style={typography.body} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.rowValue}>
              {row.quantity} {unit} · {money(row.total)}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round((row.total / max) * 100)}%` }]} />
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  dayCard: { padding: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { fontSize: 17, fontWeight: '800', color: colors.brand },
  dayMonth: { fontSize: 10, fontWeight: '700', color: colors.brand, textTransform: 'uppercase' },
  dayTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  dayTotal: { fontSize: 17, fontWeight: '800', color: colors.brand },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  detailBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  detailTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 110 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', backgroundColor: colors.brand, borderRadius: 3, minHeight: 2 },
  chartLabel: { fontSize: 9, color: colors.textFaint, height: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowValue: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.brand, borderRadius: 3 },
  entryTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  entryTotal: { fontSize: 15, fontWeight: '800', color: colors.text },
  entryNote: { fontSize: 12, color: colors.warning, fontStyle: 'italic' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  toggleText: { fontSize: 12, fontWeight: '700', color: colors.brand },
  subItem: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: spacing.sm },
});
