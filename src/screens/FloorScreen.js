import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ConfirmDialog, SegmentedControl, StatTile } from '../components/ui';
import FloorPlan from '../components/FloorPlan';
import { colors, money, spacing, typography } from '../theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatDuration } from '../lib/date';

export default function FloorScreen({ onOpenTable }) {
  const { floors, tables, occupancy, openOrders, api } = useData();
  const { isAdmin } = useAuth();
  const [floorId, setFloorId] = useState(null);
  const [editLayout, setEditLayout] = useState(false);
  const [confirm, setConfirm] = useState({ visible: false });

  const activeFloorId = floorId || floors[0]?.id;
  const floorTables = useMemo(
    () => tables.filter(table => table.floor_id === activeFloorId),
    [tables, activeFloorId]
  );

  const stats = useMemo(() => {
    const openItems = Object.entries(occupancy);
    const busyTables = openItems.length;
    const activeTotal = openOrders.reduce((sum, order) => {
      const items = api.getOrderItems(order.table_id);
      return sum + api.orderTotal(items);
    }, 0);
    const oldest = openOrders
      .slice()
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
      .find(order => (occupancy[order.table_id] || 0) > 0);
    return { busyTables, activeTotal, oldest };
  }, [occupancy, openOrders, api]);

  const askClearAll = () =>
    setConfirm({
      visible: true,
      tone: 'danger',
      title: 'Clear every open table',
      message: 'All open orders and notes will be discarded without being saved to history.',
      confirmText: 'Clear all',
      onConfirm: () => {
        api.clearAllTables();
        setConfirm({ visible: false });
      },
    });

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statRow}>
          <StatTile label="Open tables" value={`${stats.busyTables}/${tables.length}`} icon="grid-outline" />
          <StatTile label="Active value" value={money(stats.activeTotal)} icon="cash-outline" tone="success" />
          <StatTile
            label="Longest open"
            value={stats.oldest ? formatDuration(stats.oldest.started_at) : '—'}
            icon="hourglass-outline"
            tone="warning"
          />
        </View>

        {floors.length > 1 ? (
          <SegmentedControl
            options={floors.map(floor => ({ value: floor.id, label: floor.name }))}
            value={activeFloorId}
            onChange={setFloorId}
          />
        ) : null}

        {isAdmin ? (
          <View style={styles.adminRow}>
            <Button
              title={editLayout ? 'Done arranging' : 'Arrange layout'}
              icon={editLayout ? 'checkmark' : 'move-outline'}
              variant={editLayout ? 'primary' : 'outline'}
              size="sm"
              onPress={() => setEditLayout(prev => !prev)}
            />
            <Button title="Clear all tables" icon="trash-outline" variant="danger" size="sm" onPress={askClearAll} />
          </View>
        ) : null}

        {editLayout ? (
          <Card style={styles.hintCard}>
            <Text style={typography.muted}>
              Drag tables to reposition them. Positions are stored as percentages so the plan looks the same on every
              screen size.
            </Text>
          </Card>
        ) : null}

        <View style={styles.planWrap}>
          <FloorPlan
            tables={floorTables}
            occupancy={occupancy}
            editable={editLayout}
            onPressTable={table => (editLayout ? null : onOpenTable(table))}
            onMoveTable={(id, x, y) => api.moveTable(id, x, y)}
          />
        </View>

        <View style={styles.legend}>
          <Badge label="Free" tone="neutral" icon="ellipse-outline" />
          <Badge label="Serving" tone="brand" icon="restaurant-outline" />
          <Text style={typography.tiny}>Tap a table to open its order</Text>
        </View>
      </ScrollView>
      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  adminRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  hintCard: { padding: spacing.md },
  planWrap: { height: 620 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
