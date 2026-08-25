import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, Input, Sheet, StatTile } from '../components/ui';
import { colors, money, radius, spacing, typography } from '../theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  WEEKDAYS,
  addMonths,
  formatDate,
  formatDuration,
  formatTime,
  minutesBetween,
  monthGrid,
  monthLabel,
  toDateKey,
} from '../lib/date';

export default function CalendarScreen() {
  const { shifts, history, profiles, api } = useData();
  const { user, isAdmin } = useAuth();

  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toDateKey(new Date()));
  const [targetUserId, setTargetUserId] = useState(user?.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shiftDraft, setShiftDraft] = useState(null);
  const [confirm, setConfirm] = useState({ visible: false });

  const viewedUserId = isAdmin ? targetUserId || user?.id : user?.id;
  const viewedUser = profiles.find(profile => profile.id === viewedUserId) || user;

  const byDay = useMemo(() => {
    const map = {};
    shifts
      .filter(shift => shift.user_id === viewedUserId)
      .forEach(shift => {
        const key = shift.day || toDateKey(shift.clock_in);
        if (!map[key]) map[key] = { shifts: [], orders: [], minutes: 0, revenue: 0 };
        map[key].shifts.push(shift);
        map[key].minutes += shift.clock_out ? minutesBetween(shift.clock_in, shift.clock_out) : 0;
      });
    history
      .filter(entry => entry.served_by === viewedUserId)
      .forEach(entry => {
        const key = entry.day || toDateKey(entry.started_at);
        if (!map[key]) map[key] = { shifts: [], orders: [], minutes: 0, revenue: 0 };
        map[key].orders.push(entry);
        map[key].revenue += Number(entry.total_price || 0);
      });
    return map;
  }, [shifts, history, viewedUserId]);

  const monthStats = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const entries = Object.entries(byDay).filter(([key]) => key.startsWith(prefix));
    return {
      days: entries.filter(([, value]) => value.shifts.length > 0).length,
      hours: entries.reduce((sum, [, value]) => sum + value.minutes, 0) / 60,
      orders: entries.reduce((sum, [, value]) => sum + value.orders.length, 0),
      revenue: entries.reduce((sum, [, value]) => sum + value.revenue, 0),
    };
  }, [byDay, month]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const selected = byDay[selectedDay] || { shifts: [], orders: [], minutes: 0, revenue: 0 };
  const activeShift = api.getActiveShift(user?.id);
  const isOwnCalendar = viewedUserId === user?.id;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.clockCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={typography.section}>My shift</Text>
            <Text style={typography.body}>
              {activeShift
                ? `Clocked in at ${formatTime(activeShift.clock_in)} · ${formatDuration(activeShift.clock_in)}`
                : 'Not clocked in'}
            </Text>
          </View>
          <Button
            title={activeShift ? 'Clock out' : 'Clock in'}
            icon={activeShift ? 'log-out-outline' : 'log-in-outline'}
            variant={activeShift ? 'danger' : 'primary'}
            onPress={() => (activeShift ? api.clockOut(user) : api.clockIn(user))}
          />
        </Card>

        {isAdmin ? (
          <Pressable onPress={() => setPickerOpen(true)}>
            <Card style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(viewedUser)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{viewedUser?.full_name || viewedUser?.email}</Text>
                <Text style={typography.tiny}>Tap to view another team member</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        ) : null}

        <View style={styles.statRow}>
          <StatTile label="Days worked" value={String(monthStats.days)} icon="calendar-outline" />
          <StatTile label="Hours" value={monthStats.hours.toFixed(1)} icon="hourglass-outline" tone="accent" />
          <StatTile label="Orders" value={String(monthStats.orders)} icon="receipt-outline" />
          <StatTile label="Revenue" value={money(monthStats.revenue)} icon="cash-outline" tone="success" />
        </View>

        <Card style={{ gap: spacing.md }}>
          <View style={styles.monthBar}>
            <IconButton icon="chevron-back" size={34} onPress={() => setMonth(prev => addMonths(prev, -1))} />
            <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
            <IconButton icon="chevron-forward" size={34} onPress={() => setMonth(prev => addMonths(prev, 1))} />
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map(day => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map(date => {
              const key = toDateKey(date);
              const info = byDay[key];
              const inMonth = date.getMonth() === month.getMonth();
              const isSelected = key === selectedDay;
              const isToday = key === toDateKey(new Date());
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedDay(key)}
                  style={[
                    styles.cell,
                    !inMonth && styles.cellMuted,
                    info?.shifts.length ? styles.cellWorked : null,
                    isSelected && styles.cellSelected,
                  ]}
                >
                  <Text style={[styles.cellText, isSelected && styles.cellTextSelected, isToday && styles.cellToday]}>
                    {date.getDate()}
                  </Text>
                  <View style={styles.dotRow}>
                    {info?.shifts.length ? <View style={[styles.dot, { backgroundColor: colors.brand }]} /> : null}
                    {info?.orders.length ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View style={styles.rowBetween}>
          <Text style={typography.section}>{formatDate(selectedDay)}</Text>
          {isAdmin ? (
            <Button
              title="Add shift"
              icon="add"
              variant="outline"
              size="sm"
              onPress={() =>
                setShiftDraft({
                  user_id: viewedUserId,
                  user_name: viewedUser?.full_name || viewedUser?.email,
                  day: selectedDay,
                  from: '09:00',
                  to: '17:00',
                  note: '',
                })
              }
            />
          ) : null}
        </View>

        <View style={styles.statRow}>
          <StatTile
            label="Worked"
            value={selected.minutes ? `${(selected.minutes / 60).toFixed(1)}h` : '—'}
            icon="time-outline"
          />
          <StatTile label="Orders" value={String(selected.orders.length)} icon="receipt-outline" tone="accent" />
          <StatTile label="Revenue" value={money(selected.revenue)} icon="cash-outline" tone="success" />
        </View>

        {selected.shifts.length === 0 && selected.orders.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title="Nothing on this day" message="No shift and no orders recorded." />
        ) : null}

        {selected.shifts.map(shift => (
          <Card key={shift.id} style={styles.shiftCard}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.shiftTime}>
                {formatTime(shift.clock_in)} → {shift.clock_out ? formatTime(shift.clock_out) : 'in progress'}
              </Text>
              <Text style={typography.tiny}>
                {shift.clock_out ? formatDuration(shift.clock_in, shift.clock_out) : formatDuration(shift.clock_in)}
                {shift.note ? ` · ${shift.note}` : ''}
              </Text>
            </View>
            {isAdmin ? (
              <IconButton
                icon="trash-outline"
                variant="danger"
                size={34}
                onPress={() =>
                  setConfirm({
                    visible: true,
                    tone: 'danger',
                    title: 'Delete shift',
                    message: 'This attendance record will be removed.',
                    confirmText: 'Delete',
                    onConfirm: () => {
                      api.deleteShift(shift.id);
                      setConfirm({ visible: false });
                    },
                  })
                }
              />
            ) : null}
          </Card>
        ))}

        {selected.orders.length > 0 ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={typography.section}>Orders served</Text>
            {selected.orders.map(entry => (
              <View key={entry.id} style={styles.rowBetween}>
                <Text style={typography.body}>
                  {entry.table_name} · {formatTime(entry.finished_at)}
                </Text>
                <Badge label={money(entry.total_price)} tone="brand" />
              </View>
            ))}
          </Card>
        ) : null}

        {!isOwnCalendar ? (
          <Text style={typography.tiny}>Viewing {viewedUser?.full_name}'s calendar as administrator.</Text>
        ) : null}
      </ScrollView>

      <Sheet visible={pickerOpen} title="Team" subtitle="Pick whose calendar to view" onClose={() => setPickerOpen(false)}>
        {profiles.map(profile => (
          <Pressable
            key={profile.id}
            onPress={() => {
              setTargetUserId(profile.id);
              setPickerOpen(false);
            }}
          >
            <Card style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(profile)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{profile.full_name || profile.email}</Text>
                <Text style={typography.tiny}>{profile.email}</Text>
              </View>
              <Badge label={profile.role} tone={profile.role === 'admin' ? 'accent' : 'neutral'} />
            </Card>
          </Pressable>
        ))}
      </Sheet>

      <Sheet
        visible={shiftDraft !== null}
        title="Add shift"
        subtitle={shiftDraft ? formatDate(shiftDraft.day) : ''}
        onClose={() => setShiftDraft(null)}
        footer={
          <>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setShiftDraft(null)} />
            <Button
              title="Save shift"
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => {
                const clockIn = combine(shiftDraft.day, shiftDraft.from);
                const clockOut = combine(shiftDraft.day, shiftDraft.to);
                api.saveShift({
                  user_id: shiftDraft.user_id,
                  user_name: shiftDraft.user_name,
                  clock_in: clockIn,
                  clock_out: clockOut,
                  day: shiftDraft.day,
                  note: shiftDraft.note,
                });
                setShiftDraft(null);
              }}
            />
          </>
        }
      >
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.section}>From</Text>
            <Input
              value={shiftDraft?.from || ''}
              onChangeText={text => setShiftDraft(prev => ({ ...prev, from: text }))}
              placeholder="09:00"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.section}>To</Text>
            <Input
              value={shiftDraft?.to || ''}
              onChangeText={text => setShiftDraft(prev => ({ ...prev, to: text }))}
              placeholder="17:00"
            />
          </View>
        </View>
        <Input
          value={shiftDraft?.note || ''}
          onChangeText={text => setShiftDraft(prev => ({ ...prev, note: text }))}
          placeholder="Note (optional)"
        />
      </Sheet>

      <ConfirmDialog state={confirm} onCancel={() => setConfirm({ visible: false })} />
    </View>
  );
}

function combine(dayKey, timeText) {
  const [hours, minutes] = String(timeText || '00:00').split(':').map(Number);
  const [year, month, day] = String(dayKey).split('-').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0).toISOString();
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
  clockCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.brand },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 16, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    gap: 3,
  },
  cellMuted: { opacity: 0.35 },
  cellWorked: { backgroundColor: colors.surfaceAlt },
  cellSelected: { backgroundColor: colors.brand },
  cellText: { fontSize: 13, fontWeight: '600', color: colors.text },
  cellTextSelected: { color: '#04262A', fontWeight: '800' },
  cellToday: { textDecorationLine: 'underline' },
  dotRow: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  shiftCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  shiftTime: { fontSize: 15, fontWeight: '700', color: colors.text },
  timeRow: { flexDirection: 'row', gap: spacing.md },
});
