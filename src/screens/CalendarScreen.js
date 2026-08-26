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
  const [expanded, setExpanded] = useState([]);
  const [shiftDraft, setShiftDraft] = useState(null);
  const [personPicker, setPersonPicker] = useState(false);
  const [confirm, setConfirm] = useState({ visible: false });

  const nameOf = useMemo(() => {
    const map = {};
    profiles.forEach(profile => {
      map[profile.id] = profile.full_name || profile.email;
    });
    return map;
  }, [profiles]);

  const roleOf = useMemo(() => {
    const map = {};
    profiles.forEach(profile => {
      map[profile.id] = profile.role;
    });
    return map;
  }, [profiles]);

  // Employees only ever see their own attendance and their own orders.
  const days = useMemo(() => {
    const scopedShifts = isAdmin ? shifts : shifts.filter(shift => shift.user_id === user?.id);
    const scopedHistory = isAdmin ? history : history.filter(entry => entry.served_by === user?.id);
    const map = {};

    const ensureDay = key => {
      if (!map[key]) map[key] = { key, people: {}, minutes: 0, revenue: 0, orders: 0 };
      return map[key];
    };
    const ensurePerson = (key, id, fallbackName) => {
      const day = ensureDay(key);
      if (!day.people[id]) {
        day.people[id] = { id, name: nameOf[id] || fallbackName || 'Unknown', shifts: [], orders: [], minutes: 0, revenue: 0 };
      }
      return day.people[id];
    };

    scopedShifts.forEach(shift => {
      const key = shift.day || toDateKey(shift.clock_in);
      if (!key) return;
      const person = ensurePerson(key, shift.user_id || 'unknown', shift.user_name);
      const worked = shift.clock_out ? minutesBetween(shift.clock_in, shift.clock_out) : 0;
      person.shifts.push(shift);
      person.minutes += worked;
      map[key].minutes += worked;
    });

    scopedHistory.forEach(entry => {
      const key = entry.day || toDateKey(entry.started_at);
      if (!key) return;
      const person = ensurePerson(key, entry.served_by || 'unknown', entry.served_by_name);
      const total = Number(entry.total_price || 0);
      person.orders.push(entry);
      person.revenue += total;
      map[key].revenue += total;
      map[key].orders += 1;
    });

    Object.values(map).forEach(day => {
      day.list = Object.values(day.people).sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
    });
    return map;
  }, [shifts, history, isAdmin, user, nameOf]);

  const monthStats = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const entries = Object.values(days).filter(day => day.key.startsWith(prefix));
    const staff = new Set();
    entries.forEach(day => day.list.forEach(person => person.shifts.length && staff.add(person.id)));
    return {
      activeDays: entries.filter(day => day.list.some(person => person.shifts.length > 0)).length,
      hours: entries.reduce((sum, day) => sum + day.minutes, 0) / 60,
      orders: entries.reduce((sum, day) => sum + day.orders, 0),
      revenue: entries.reduce((sum, day) => sum + day.revenue, 0),
      staff: staff.size,
    };
  }, [days, month]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const selected = days[selectedDay];
  const people = selected?.list || [];
  const activeShift = api.getActiveShift(user?.id);

  const toggle = id => setExpanded(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));

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

        <View style={styles.statRow}>
          <StatTile label={isAdmin ? 'Days with staff' : 'Days worked'} value={String(monthStats.activeDays)} icon="calendar-outline" />
          <StatTile label={isAdmin ? 'Team hours' : 'Hours'} value={monthStats.hours.toFixed(1)} icon="hourglass-outline" tone="accent" />
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
              const info = days[key];
              const staffCount = info ? info.list.filter(person => person.shifts.length > 0).length : 0;
              const inMonth = date.getMonth() === month.getMonth();
              const isSelected = key === selectedDay;
              const isToday = key === toDateKey(new Date());
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelectedDay(key);
                    setExpanded([]);
                  }}
                  style={[
                    styles.cell,
                    !inMonth && styles.cellMuted,
                    info && styles.cellActive,
                    isSelected && styles.cellSelected,
                  ]}
                >
                  <Text style={[styles.cellText, isSelected && styles.cellTextSelected, isToday && styles.cellToday]}>
                    {date.getDate()}
                  </Text>
                  {isAdmin ? (
                    <View style={styles.dotRow}>
                      {staffCount > 0 ? (
                        <View style={[styles.staffPill, isSelected && styles.staffPillSelected]}>
                          <Text style={[styles.staffPillText, isSelected && styles.staffPillTextSelected]}>
                            {staffCount}
                          </Text>
                        </View>
                      ) : null}
                      {info?.orders ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                    </View>
                  ) : (
                    <View style={styles.dotRow}>
                      {staffCount > 0 ? <View style={[styles.dot, { backgroundColor: colors.brand }]} /> : null}
                      {info?.orders ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            {isAdmin ? (
              <View style={styles.legendItem}>
                <View style={styles.staffPill}>
                  <Text style={styles.staffPillText}>#</Text>
                </View>
                <Text style={typography.tiny}>people on shift</Text>
              </View>
            ) : (
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.brand }]} />
                <Text style={typography.tiny}>on shift</Text>
              </View>
            )}
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={typography.tiny}>orders served</Text>
            </View>
          </View>
        </Card>

        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayTitle}>{formatDate(selectedDay)}</Text>
            <Text style={typography.tiny}>
              {isAdmin ? `${people.length} team member${people.length === 1 ? '' : 's'} on this day` : 'Your day'}
            </Text>
          </View>
          {isAdmin ? (
            <Button
              title="Add shift"
              icon="add"
              variant="outline"
              size="sm"
              onPress={() =>
                setShiftDraft({
                  user_id: user?.id,
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
            value={selected?.minutes ? `${(selected.minutes / 60).toFixed(1)}h` : '—'}
            icon="time-outline"
          />
          <StatTile label="Orders" value={String(selected?.orders || 0)} icon="receipt-outline" tone="accent" />
          <StatTile label="Revenue" value={money(selected?.revenue || 0)} icon="cash-outline" tone="success" />
        </View>

        {people.length === 0 ? (
          <EmptyState
            icon="calendar-clear-outline"
            title="Nothing on this day"
            message={isAdmin ? 'Nobody clocked in and no orders were served.' : 'You had no shift and served no orders.'}
          />
        ) : (
          people.map(person => {
            const open = expanded.includes(person.id);
            const onShift = person.shifts.some(shift => !shift.clock_out);
            return (
              <Card key={person.id} style={styles.personCard}>
                <Pressable onPress={() => toggle(person.id)} style={styles.personHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(person.name)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.personName}>
                      {person.name}
                      {person.id === user?.id ? ' (you)' : ''}
                    </Text>
                    <View style={styles.badgeRow}>
                      {roleOf[person.id] === 'admin' ? <Badge label="admin" tone="accent" /> : null}
                      <Badge
                        label={
                          person.minutes
                            ? `${(person.minutes / 60).toFixed(1)}h`
                            : onShift
                              ? 'on shift now'
                              : 'no shift'
                        }
                        tone={person.minutes || onShift ? 'brand' : 'neutral'}
                        icon="time-outline"
                      />
                      <Badge label={`${person.orders.length} orders`} tone="neutral" icon="receipt-outline" />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.personTotal}>{money(person.revenue)}</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
                  </View>
                </Pressable>

                {open ? (
                  <View style={styles.personBody}>
                    <Text style={typography.section}>Attendance</Text>
                    {person.shifts.length === 0 ? (
                      <Text style={typography.muted}>No shift recorded.</Text>
                    ) : (
                      person.shifts.map(shift => (
                        <View key={shift.id} style={styles.shiftRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={typography.body}>
                              {formatTime(shift.clock_in)} → {shift.clock_out ? formatTime(shift.clock_out) : 'in progress'}
                            </Text>
                            <Text style={typography.tiny}>
                              {shift.clock_out
                                ? formatDuration(shift.clock_in, shift.clock_out)
                                : formatDuration(shift.clock_in)}
                              {shift.note ? ` · ${shift.note}` : ''}
                            </Text>
                          </View>
                          {isAdmin ? (
                            <IconButton
                              icon="trash-outline"
                              variant="danger"
                              size={32}
                              onPress={() =>
                                setConfirm({
                                  visible: true,
                                  tone: 'danger',
                                  title: 'Delete shift',
                                  message: `Remove ${person.name}'s attendance record for this day?`,
                                  confirmText: 'Delete',
                                  onConfirm: () => {
                                    api.deleteShift(shift.id);
                                    setConfirm({ visible: false });
                                  },
                                })
                              }
                            />
                          ) : null}
                        </View>
                      ))
                    )}

                    <Text style={[typography.section, { marginTop: spacing.sm }]}>Orders served</Text>
                    {person.orders.length === 0 ? (
                      <Text style={typography.muted}>No orders finished on this day.</Text>
                    ) : (
                      person.orders
                        .slice()
                        .sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))
                        .map(entry => (
                          <View key={entry.id} style={styles.orderRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={typography.body}>
                                {entry.table_name} · {formatTime(entry.finished_at)}
                              </Text>
                              <Text style={typography.tiny}>
                                {(entry.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} items ·{' '}
                                {entry.payment_method || 'cash'}
                                {entry.order_note ? ` · ${entry.order_note}` : ''}
                              </Text>
                            </View>
                            <Text style={styles.orderTotal}>{money(entry.total_price)}</Text>
                          </View>
                        ))
                    )}

                    {isAdmin ? (
                      <Button
                        title="Add shift for this person"
                        icon="add"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          setShiftDraft({
                            user_id: person.id,
                            day: selectedDay,
                            from: '09:00',
                            to: '17:00',
                            note: '',
                          })
                        }
                      />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

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
                api.saveShift({
                  user_id: shiftDraft.user_id,
                  user_name: nameOf[shiftDraft.user_id] || 'Unknown',
                  clock_in: combine(shiftDraft.day, shiftDraft.from),
                  clock_out: combine(shiftDraft.day, shiftDraft.to),
                  day: shiftDraft.day,
                  note: shiftDraft.note,
                });
                setShiftDraft(null);
              }}
            />
          </>
        }
      >
        <Pressable onPress={() => setPersonPicker(true)}>
          <Card style={styles.pickerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(nameOf[shiftDraft?.user_id] || '?')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{nameOf[shiftDraft?.user_id] || 'Pick a team member'}</Text>
              <Text style={typography.tiny}>Tap to change</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Card>
        </Pressable>
        <View style={styles.timeRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={typography.section}>From</Text>
            <Input
              value={shiftDraft?.from || ''}
              onChangeText={text => setShiftDraft(prev => ({ ...prev, from: text }))}
              placeholder="09:00"
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
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

      <Sheet visible={personPicker} title="Team" onClose={() => setPersonPicker(false)}>
        {profiles.map(profile => (
          <Pressable
            key={profile.id}
            onPress={() => {
              setShiftDraft(prev => ({ ...prev, user_id: profile.id }));
              setPersonPicker(false);
            }}
          >
            <Card style={styles.pickerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(profile.full_name || profile.email)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{profile.full_name || profile.email}</Text>
                <Text style={typography.tiny}>{profile.email}</Text>
              </View>
              <Badge label={profile.role} tone={profile.role === 'admin' ? 'accent' : 'neutral'} />
            </Card>
          </Pressable>
        ))}
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

function initials(name) {
  return String(name || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  clockCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
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
    gap: 2,
  },
  cellMuted: { opacity: 0.35 },
  cellActive: { backgroundColor: colors.surfaceAlt },
  cellSelected: { backgroundColor: colors.brand },
  cellText: { fontSize: 13, fontWeight: '600', color: colors.text },
  cellTextSelected: { color: '#04262A', fontWeight: '800' },
  cellToday: { textDecorationLine: 'underline' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 14 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  staffPill: {
    minWidth: 16,
    height: 14,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffPillSelected: { backgroundColor: 'rgba(4, 38, 42, 0.22)' },
  staffPillText: { fontSize: 9, fontWeight: '800', color: colors.brand },
  staffPillTextSelected: { color: '#04262A' },
  legendRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dayTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  personCard: { padding: spacing.md, gap: spacing.sm },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personBody: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  personName: { fontSize: 15, fontWeight: '700', color: colors.text },
  personTotal: { fontSize: 15, fontWeight: '800', color: colors.brand },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.brand },
  shiftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  orderTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  timeRow: { flexDirection: 'row', gap: spacing.md },
});
