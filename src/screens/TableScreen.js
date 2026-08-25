import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Input, SegmentedControl, Sheet } from '../components/ui';
import { colors, money, radius, spacing, typography } from '../theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useLayoutInfo } from '../hooks/useLayoutInfo';
import { formatDuration } from '../lib/date';

const PAYMENTS = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'card', label: 'Card', icon: 'card-outline' },
  { value: 'transfer', label: 'Transfer', icon: 'swap-horizontal-outline' },
];

export default function TableScreen({ table, onClose }) {
  const { menuItems, categories, api } = useData();
  const { user } = useAuth();
  const { isWide } = useLayoutInfo();

  const [pane, setPane] = useState('order');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [noteDraft, setNoteDraft] = useState(null);
  const [itemNote, setItemNote] = useState(null);
  const [payment, setPayment] = useState('cash');
  const [confirm, setConfirm] = useState({ visible: false });

  const items = api.getOrderItems(table.id);
  const openOrder = api.getOpenOrder(table.id);
  const total = api.orderTotal(items);

  const filteredMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menuItems.filter(item => {
      if (item.available === false) return false;
      if (category && item.category !== category) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) || String(item.category).toLowerCase().includes(query)
      );
    });
  }, [menuItems, category, search]);

  const askFinish = () => {
    if (items.length === 0) return;
    setConfirm({
      visible: true,
      title: 'Finish order',
      message: `Charge ${money(total)} and move ${table.name} to history?`,
      confirmText: 'Finish',
      onConfirm: () => {
        api.finishOrder({ table, items, user, paymentMethod: payment });
        setConfirm({ visible: false });
        onClose();
      },
    });
  };

  const askClear = () =>
    setConfirm({
      visible: true,
      tone: 'danger',
      title: `Clear ${table.name}`,
      message: 'Remove every item and note from this table without saving to history.',
      confirmText: 'Clear table',
      onConfirm: () => {
        api.clearTable(table.id);
        setConfirm({ visible: false });
      },
    });

  const orderPane = (
    <ScrollView contentContainerStyle={styles.paneContent} showsVerticalScrollIndicator={false}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={{ gap: 4 }}>
            <Text style={typography.section}>Total</Text>
            <Text style={styles.total}>{money(total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Badge
              label={openOrder ? `Open ${formatDuration(openOrder.started_at)}` : 'Not started'}
              tone={openOrder ? 'brand' : 'neutral'}
              icon="time-outline"
            />
            <Text style={typography.tiny}>{items.reduce((sum, item) => sum + item.quantity, 0)} items</Text>
          </View>
        </View>
        <SegmentedControl options={PAYMENTS} value={payment} onChange={setPayment} size="sm" />
        <View style={styles.summaryActions}>
          <Button
            title="Finish order"
            icon="checkmark-circle-outline"
            variant="primary"
            onPress={askFinish}
            disabled={items.length === 0}
            style={{ flex: 1 }}
          />
          <Button title="Clear" icon="trash-outline" variant="danger" onPress={askClear} />
        </View>
      </Card>

      <Card style={styles.noteCard}>
        <View style={styles.rowBetween}>
          <Text style={typography.section}>Order note</Text>
          <IconButton
            icon={openOrder?.note ? 'create-outline' : 'add'}
            variant="ghost"
            size={32}
            color={colors.brand}
            onPress={() => setNoteDraft(openOrder?.note || '')}
          />
        </View>
        <Text style={openOrder?.note ? typography.body : typography.muted}>
          {openOrder?.note || 'No note for this order yet.'}
        </Text>
      </Card>

      <Text style={typography.section}>Items</Text>
      {items.length === 0 ? (
        <EmptyState
          icon="fast-food-outline"
          title="Nothing ordered yet"
          message="Pick products from the menu to start this table."
          action={<Button title="Open menu" icon="restaurant-outline" variant="primary" onPress={() => setPane('menu')} />}
        />
      ) : (
        items.map(item => (
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemMain}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={typography.muted}>
                  {money(item.price)} · {money(item.price * item.quantity)}
                </Text>
                {item.note ? <Text style={styles.itemNote}>“{item.note}”</Text> : null}
              </View>
              <View style={styles.qtyRow}>
                <IconButton icon="remove" size={32} onPress={() => api.setItemQuantity(item.id, item.quantity - 1)} />
                <Text style={styles.qty}>{item.quantity}</Text>
                <IconButton
                  icon="add"
                  size={32}
                  variant="primary"
                  onPress={() => api.setItemQuantity(item.id, item.quantity + 1)}
                />
              </View>
            </View>
            <View style={styles.itemActions}>
              <Button
                title={item.note ? 'Edit note' : 'Add note'}
                icon="chatbubble-ellipses-outline"
                variant="ghost"
                size="sm"
                onPress={() => setItemNote({ id: item.id, text: item.note || '' })}
              />
              <Button
                title="Remove"
                icon="close"
                variant="ghost"
                size="sm"
                onPress={() => api.removeItem(item.id)}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );

  const menuPane = (
    <View style={styles.menuPane}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textFaint} style={styles.searchIcon} />
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search the menu…"
          style={styles.searchInput}
        />
        {search ? <IconButton icon="close" variant="ghost" size={34} onPress={() => setSearch('')} /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All" active={!category} onPress={() => setCategory(null)} />
        {categories.map(cat => (
          <Chip key={cat} label={cat} active={category === cat} onPress={() => setCategory(cat)} />
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.menuGrid} showsVerticalScrollIndicator={false}>
        {filteredMenu.length === 0 ? (
          <EmptyState icon="search-outline" title="No products found" message="Try another search or category." />
        ) : (
          filteredMenu.map(item => {
            const inOrder = items.find(row => row.menu_item_id === item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => api.addMenuItemToTable(table.id, item, user?.id)}
                style={({ pressed }) => [styles.menuCard, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.menuName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={typography.tiny}>{item.category}</Text>
                <View style={styles.menuFooter}>
                  <Text style={styles.menuPrice}>{money(item.price)}</Text>
                  {inOrder ? <Badge label={`x${inOrder.quantity}`} tone="brand" /> : <Ionicons name="add-circle" size={20} color={colors.brand} />}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" onPress={onClose} />
        <View style={{ flex: 1 }}>
          <Text style={styles.tableTitle}>{table.name}</Text>
          <Text style={typography.tiny}>{table.seats || 4} seats</Text>
        </View>
        <Text style={styles.topTotal}>{money(total)}</Text>
      </View>

      {isWide ? (
        <View style={styles.wideRow}>
          <View style={styles.wideLeft}>{orderPane}</View>
          <View style={styles.wideRight}>{menuPane}</View>
        </View>
      ) : (
        <>
          <View style={styles.tabRow}>
            <SegmentedControl
              options={[
                { value: 'order', label: `Order (${items.length})`, icon: 'receipt-outline' },
                { value: 'menu', label: 'Menu', icon: 'restaurant-outline' },
              ]}
              value={pane}
              onChange={setPane}
            />
          </View>
          <View style={{ flex: 1 }}>{pane === 'order' ? orderPane : menuPane}</View>
        </>
      )}

      <Sheet
        visible={noteDraft !== null}
        title="Order note"
        subtitle={table.name}
        onClose={() => setNoteDraft(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setNoteDraft(null)} />
            <Button
              title="Save note"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                api.setOrderNote(table.id, noteDraft, user?.id);
                setNoteDraft(null);
              }}
            />
          </>
        }
      >
        <Input
          value={noteDraft || ''}
          onChangeText={setNoteDraft}
          placeholder="Allergies, split bill, table preferences…"
          multiline
        />
      </Sheet>

      <Sheet
        visible={itemNote !== null}
        title="Item note"
        onClose={() => setItemNote(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setItemNote(null)} />
            <Button
              title="Save"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                api.setItemNote(itemNote.id, itemNote.text);
                setItemNote(null);
              }}
            />
          </>
        }
      >
        <Input
          value={itemNote?.text || ''}
          onChangeText={text => setItemNote(prev => ({ ...prev, text }))}
          placeholder="No sugar, extra hot, to go…"
          multiline
        />
      </Sheet>

      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  tableTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  topTotal: { fontSize: 18, fontWeight: '800', color: colors.brand },
  tabRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  paneContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  summaryCard: { gap: spacing.md },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  total: { fontSize: 28, fontWeight: '800', color: colors.text },
  summaryActions: { flexDirection: 'row', gap: spacing.sm },
  noteCard: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemCard: { gap: spacing.sm, padding: spacing.md },
  itemMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemNote: { fontSize: 12, color: colors.warning, fontStyle: 'italic' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qty: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 24, textAlign: 'center' },
  itemActions: { flexDirection: 'row', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.xs },
  menuPane: { flex: 1, paddingTop: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  searchIcon: { position: 'absolute', left: spacing.lg + 12, zIndex: 2 },
  searchInput: { flex: 1, paddingLeft: 36 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: '#04262A' },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  menuCard: {
    width: 152,
    minHeight: 104,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 4,
    justifyContent: 'space-between',
  },
  menuName: { fontSize: 14, fontWeight: '700', color: colors.text },
  menuFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  menuPrice: { fontSize: 14, fontWeight: '800', color: colors.brand },
  wideRow: { flex: 1, flexDirection: 'row' },
  wideLeft: { flex: 1, borderRightWidth: 1, borderRightColor: colors.borderSoft },
  wideRight: { flex: 1.2 },
});
