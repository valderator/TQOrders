import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Input, SegmentedControl, Sheet } from '../components/ui';
import { colors, money, radius, spacing, typography } from '../theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { value: 'menu', label: 'Menu', icon: 'restaurant-outline' },
  { value: 'tables', label: 'Tables', icon: 'grid-outline' },
  { value: 'team', label: 'Team', icon: 'people-outline' },
];

export default function ManageScreen() {
  const [tab, setTab] = useState('menu');
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="lock-closed-outline"
          title="Admins only"
          message="Ask an administrator if you need menu, table or team changes."
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabWrap}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </View>
      {tab === 'menu' ? <MenuManager /> : null}
      {tab === 'tables' ? <TableManager /> : null}
      {tab === 'team' ? <TeamManager /> : null}
    </View>
  );
}

function MenuManager() {
  const { menuItems, categories, api } = useData();
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState({ visible: false });
  const [filter, setFilter] = useState('');

  const visible = menuItems.filter(item =>
    `${item.name} ${item.category}`.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.rowGap}>
        <Input value={filter} onChangeText={setFilter} placeholder="Filter products…" style={{ flex: 1 }} />
        <Button
          title="New"
          icon="add"
          variant="primary"
          onPress={() => setDraft({ name: '', price: '', category: categories[0] || 'Drinks', available: true })}
        />
      </View>

      {visible.map(item => (
        <Card key={item.id} style={styles.rowCard}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={typography.tiny}>{item.category}</Text>
          </View>
          <Text style={styles.price}>{money(item.price)}</Text>
          <Badge label={item.available === false ? 'Hidden' : 'Live'} tone={item.available === false ? 'warning' : 'success'} />
          <IconButton icon="create-outline" size={34} onPress={() => setDraft({ ...item, price: String(item.price) })} />
          <IconButton
            icon="trash-outline"
            variant="danger"
            size={34}
            onPress={() =>
              setConfirm({
                visible: true,
                tone: 'danger',
                title: `Delete ${item.name}`,
                message: 'The product disappears from the menu. Past orders keep their history.',
                confirmText: 'Delete',
                onConfirm: () => {
                  api.deleteMenuItem(item.id);
                  setConfirm({ visible: false });
                },
              })
            }
          />
        </Card>
      ))}

      <Sheet
        visible={draft !== null}
        title={draft?.id ? 'Edit product' : 'New product'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button
              title="Save"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                if (!draft.name.trim()) return;
                api.saveMenuItem({ ...draft, price: Number(String(draft.price).replace(',', '.')) || 0 });
                setDraft(null);
              }}
            />
          </>
        }
      >
        <Input
          value={draft?.name || ''}
          onChangeText={text => setDraft(prev => ({ ...prev, name: text }))}
          placeholder="Product name"
        />
        <Input
          value={String(draft?.price ?? '')}
          onChangeText={text => setDraft(prev => ({ ...prev, price: text }))}
          placeholder="Price"
          keyboardType="decimal-pad"
        />
        <Input
          value={draft?.category || ''}
          onChangeText={text => setDraft(prev => ({ ...prev, category: text }))}
          placeholder="Category"
        />
        <View style={styles.rowGap}>
          {categories.map(cat => (
            <Pressable key={cat} onPress={() => setDraft(prev => ({ ...prev, category: cat }))}>
              <Badge label={cat} tone={draft?.category === cat ? 'brand' : 'neutral'} />
            </Pressable>
          ))}
        </View>
        <Button
          title={draft?.available === false ? 'Hidden from waiters' : 'Visible to waiters'}
          icon={draft?.available === false ? 'eye-off-outline' : 'eye-outline'}
          variant="outline"
          onPress={() => setDraft(prev => ({ ...prev, available: prev.available === false }))}
        />
      </Sheet>

      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </ScrollView>
  );
}

function TableManager() {
  const { floors, tables, api } = useData();
  const [draft, setDraft] = useState(null);
  const [floorDraft, setFloorDraft] = useState(null);
  const [confirm, setConfirm] = useState({ visible: false });

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.rowGap}>
        <Button title="New floor" icon="layers-outline" variant="outline" onPress={() => setFloorDraft({ name: '' })} />
        <Button
          title="New table"
          icon="add"
          variant="primary"
          onPress={() => setDraft({ name: '', floor_id: floors[0]?.id, seats: '4', x: 0.05, y: 0.05, w: 0.32, h: 0.1 })}
        />
      </View>

      {floors.map(floor => (
        <View key={floor.id} style={{ gap: spacing.sm }}>
          <View style={styles.rowBetween}>
            <Text style={typography.section}>{floor.name}</Text>
            <View style={styles.rowGap}>
              <IconButton icon="create-outline" size={32} onPress={() => setFloorDraft(floor)} />
              <IconButton
                icon="trash-outline"
                variant="danger"
                size={32}
                onPress={() =>
                  setConfirm({
                    visible: true,
                    tone: 'danger',
                    title: `Delete ${floor.name}`,
                    message: 'The floor and all of its tables will be removed.',
                    confirmText: 'Delete floor',
                    onConfirm: () => {
                      api.deleteFloor(floor.id);
                      setConfirm({ visible: false });
                    },
                  })
                }
              />
            </View>
          </View>
          {tables
            .filter(table => table.floor_id === floor.id)
            .map(table => (
              <Card key={table.id} style={styles.rowCard}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{table.name}</Text>
                  <Text style={typography.tiny}>
                    {table.seats || 4} seats · {(table.x * 100).toFixed(0)}% / {(table.y * 100).toFixed(0)}%
                  </Text>
                </View>
                <IconButton
                  icon="create-outline"
                  size={34}
                  onPress={() => setDraft({ ...table, seats: String(table.seats || 4) })}
                />
                <IconButton
                  icon="trash-outline"
                  variant="danger"
                  size={34}
                  onPress={() =>
                    setConfirm({
                      visible: true,
                      tone: 'danger',
                      title: `Delete ${table.name}`,
                      message: 'Any open order on this table is discarded.',
                      confirmText: 'Delete',
                      onConfirm: () => {
                        api.deleteTable(table.id);
                        setConfirm({ visible: false });
                      },
                    })
                  }
                />
              </Card>
            ))}
        </View>
      ))}

      <Sheet
        visible={draft !== null}
        title={draft?.id ? 'Edit table' : 'New table'}
        subtitle="Position and size are percentages of the floor plan"
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button
              title="Save"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                if (!draft.name.trim()) return;
                api.saveTable({ ...draft, seats: Number(draft.seats) || 4 });
                setDraft(null);
              }}
            />
          </>
        }
      >
        <Input
          value={draft?.name || ''}
          onChangeText={text => setDraft(prev => ({ ...prev, name: text }))}
          placeholder="Table name (M1, T4, BAR…)"
        />
        <View style={styles.rowGap}>
          {floors.map(floor => (
            <Pressable key={floor.id} onPress={() => setDraft(prev => ({ ...prev, floor_id: floor.id }))}>
              <Badge label={floor.name} tone={draft?.floor_id === floor.id ? 'brand' : 'neutral'} />
            </Pressable>
          ))}
        </View>
        <Input
          value={String(draft?.seats ?? '')}
          onChangeText={text => setDraft(prev => ({ ...prev, seats: text }))}
          placeholder="Seats"
          keyboardType="number-pad"
        />
        <View style={styles.rowGap}>
          <PercentInput label="Width %" value={draft?.w} onChange={value => setDraft(prev => ({ ...prev, w: value }))} />
          <PercentInput label="Height %" value={draft?.h} onChange={value => setDraft(prev => ({ ...prev, h: value }))} />
        </View>
        <Text style={typography.tiny}>Tip: drag tables directly on the floor plan to place them.</Text>
      </Sheet>

      <Sheet
        visible={floorDraft !== null}
        title={floorDraft?.id ? 'Edit floor' : 'New floor'}
        onClose={() => setFloorDraft(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setFloorDraft(null)} />
            <Button
              title="Save"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                if (!floorDraft.name.trim()) return;
                api.saveFloor(floorDraft);
                setFloorDraft(null);
              }}
            />
          </>
        }
      >
        <Input
          value={floorDraft?.name || ''}
          onChangeText={text => setFloorDraft(prev => ({ ...prev, name: text }))}
          placeholder="Floor name (Salon, Terasa, Etaj 1…)"
        />
      </Sheet>

      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </ScrollView>
  );
}

function PercentInput({ label, value, onChange }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={typography.section}>{label}</Text>
      <Input
        value={String(Math.round((value || 0) * 100))}
        onChangeText={text => onChange((Number(text) || 0) / 100)}
        keyboardType="number-pad"
      />
    </View>
  );
}

function TeamManager() {
  const { profiles, api } = useData();
  const { localMode, user, createUser } = useAuth();
  const [draft, setDraft] = useState(null);
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submitInvite = async () => {
    if (!invite.email.trim() || invite.password.length < 6) {
      setError('An email and a password of at least 6 characters are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user: created, needsConfirmation } = await createUser(invite);
      api.saveProfile({
        id: created.id,
        email: invite.email.trim(),
        full_name: invite.full_name || invite.email.trim(),
        role: invite.role,
        active: true,
      });
      setNotice(
        needsConfirmation
          ? `${invite.email} was created but must confirm their email before signing in.`
          : `${invite.email} can sign in now as ${invite.role}.`
      );
      setInvite(null);
    } catch (err) {
      setError(err?.message || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card style={{ gap: 6 }}>
        <Text style={typography.section}>How accounts work</Text>
        <Text style={typography.muted}>
          {localMode
            ? 'Local mode: accounts live on this device only. Add Supabase keys to share them across devices.'
            : 'New accounts always start as employees. Promote them to admin here once they exist.'}
        </Text>
      </Card>

      <Button
        title={localMode ? 'New local account' : 'Add team member'}
        icon="person-add-outline"
        variant="primary"
        onPress={() =>
          localMode
            ? setDraft({ email: '', full_name: '', role: 'employee', pin: '', active: true })
            : setInvite({ email: '', full_name: '', password: '', role: 'employee' })
        }
      />

      {notice ? (
        <Card style={styles.noticeCard}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <Text style={[typography.muted, { flex: 1 }]}>{notice}</Text>
        </Card>
      ) : null}

      {profiles.map(profile => (
        <Card key={profile.id} style={styles.rowCard}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rowTitle}>{profile.full_name || profile.email}</Text>
            <Text style={typography.tiny}>{profile.email}</Text>
          </View>
          <Badge label={profile.role} tone={profile.role === 'admin' ? 'accent' : 'neutral'} />
          <Badge label={profile.active === false ? 'Disabled' : 'Active'} tone={profile.active === false ? 'danger' : 'success'} />
          {profile.id === user?.id ? null : (
            <Button
              title={profile.role === 'admin' ? 'Make employee' : 'Make admin'}
              icon={profile.role === 'admin' ? 'arrow-down-outline' : 'shield-checkmark-outline'}
              variant="outline"
              size="sm"
              onPress={() => api.saveProfile({ ...profile, role: profile.role === 'admin' ? 'employee' : 'admin' })}
            />
          )}
          <IconButton icon="create-outline" size={34} onPress={() => setDraft({ ...profile })} />
        </Card>
      ))}

      <Sheet
        visible={invite !== null}
        title="Add team member"
        subtitle="Creates the login and the profile in one step"
        onClose={() => {
          setInvite(null);
          setError(null);
        }}
        footer={
          <>
            <Button
              title="Cancel"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                setInvite(null);
                setError(null);
              }}
            />
            <Button title="Create account" variant="primary" style={{ flex: 1 }} loading={busy} onPress={submitInvite} />
          </>
        }
      >
        <Input
          value={invite?.full_name || ''}
          onChangeText={text => setInvite(prev => ({ ...prev, full_name: text }))}
          placeholder="Full name"
        />
        <Input
          value={invite?.email || ''}
          onChangeText={text => setInvite(prev => ({ ...prev, email: text }))}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          value={invite?.password || ''}
          onChangeText={text => setInvite(prev => ({ ...prev, password: text }))}
          placeholder="Temporary password (min. 6 characters)"
          secureTextEntry
        />
        <View style={styles.rowGap}>
          {['employee', 'admin'].map(role => (
            <Pressable key={role} onPress={() => setInvite(prev => ({ ...prev, role }))}>
              <Badge label={role} tone={invite?.role === role ? 'brand' : 'neutral'} />
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={typography.tiny}>
          Share the password with the new member and ask them to change it later. Turn off “Confirm email” in Supabase →
          Authentication → Providers → Email so they can sign in immediately.
        </Text>
      </Sheet>

      <Sheet
        visible={draft !== null}
        title={draft?.id ? 'Edit member' : 'New member'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button
              title="Save"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                if (!draft.email?.trim()) return;
                api.saveProfile({ ...draft, id: draft.id || `local-${Date.now()}` });
                setDraft(null);
              }}
            />
          </>
        }
      >
        <Input
          value={draft?.full_name || ''}
          onChangeText={text => setDraft(prev => ({ ...prev, full_name: text }))}
          placeholder="Full name"
        />
        <Input
          value={draft?.email || ''}
          onChangeText={text => setDraft(prev => ({ ...prev, email: text }))}
          placeholder="Email"
          autoCapitalize="none"
          editable={localMode || !draft?.id}
        />
        {localMode ? (
          <Input
            value={draft?.pin || ''}
            onChangeText={text => setDraft(prev => ({ ...prev, pin: text }))}
            placeholder="PIN"
            keyboardType="number-pad"
          />
        ) : null}
        <View style={styles.rowGap}>
          {['employee', 'admin'].map(role => (
            <Pressable key={role} onPress={() => setDraft(prev => ({ ...prev, role }))}>
              <Badge label={role} tone={draft?.role === role ? 'brand' : 'neutral'} />
            </Pressable>
          ))}
        </View>
        <Button
          title={draft?.active === false ? 'Account disabled' : 'Account active'}
          icon={draft?.active === false ? 'close-circle-outline' : 'checkmark-circle-outline'}
          variant="outline"
          disabled={draft?.id === user?.id}
          onPress={() => setDraft(prev => ({ ...prev, active: prev.active === false }))}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabWrap: { padding: spacing.lg, paddingBottom: 0, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  rowGap: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  price: { fontSize: 14, fontWeight: '800', color: colors.brand },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  errorText: { fontSize: 13, color: colors.danger },
});
