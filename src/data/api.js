import { uuid, nowIso } from '../lib/ids';
import { toDateKey } from '../lib/date';
import { DEFAULT_FLOORS, DEFAULT_MENU_ITEMS, DEFAULT_TABLES } from './seed';
import { remove, seedIfEmpty, selectAll, selectById, upsert } from './store';

const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name));

export function ensureSeed() {
  seedIfEmpty('floors', DEFAULT_FLOORS);
  seedIfEmpty('dining_tables', DEFAULT_TABLES);
  seedIfEmpty('menu_items', DEFAULT_MENU_ITEMS);
}

/* ---------------------------------------------------------------- floors */

export function getFloors() {
  return selectAll('floors').sort(byOrder);
}

export function saveFloor(input) {
  return upsert('floors', {
    id: input.id || uuid(),
    name: input.name,
    sort_order: input.sort_order ?? getFloors().length,
  });
}

export function deleteFloor(floorId) {
  getTables().filter(table => table.floor_id === floorId).forEach(table => remove('dining_tables', table.id));
  remove('floors', floorId);
}

/* ---------------------------------------------------------------- tables */

export function getTables(floorId) {
  const tables = selectAll('dining_tables').sort(byOrder);
  return floorId ? tables.filter(table => table.floor_id === floorId) : tables;
}

export function saveTable(input) {
  return upsert('dining_tables', {
    id: input.id || uuid(),
    name: input.name,
    floor_id: input.floor_id,
    x: clamp01(input.x ?? 0.05),
    y: clamp01(input.y ?? 0.05),
    w: clamp01(input.w ?? 0.32, 0.08),
    h: clamp01(input.h ?? 0.1, 0.05),
    seats: Number(input.seats) || 4,
    sort_order: input.sort_order ?? getTables().length,
  });
}

export function moveTable(tableId, x, y) {
  const table = selectById('dining_tables', tableId);
  if (!table) return;
  upsert('dining_tables', { ...table, x: clamp01(x), y: clamp01(y) });
}

export function deleteTable(tableId) {
  clearTable(tableId);
  remove('dining_tables', tableId);
}

function clamp01(value, min = 0) {
  return Math.min(1, Math.max(min, Number(value) || 0));
}

/* ------------------------------------------------------------------ menu */

export function getMenuItems() {
  return selectAll('menu_items').sort(byOrder);
}

export function getMenuCategories() {
  return Array.from(new Set(getMenuItems().map(item => item.category || 'Other'))).sort();
}

export function saveMenuItem(input) {
  return upsert('menu_items', {
    id: input.id || uuid(),
    name: input.name,
    price: Number(input.price) || 0,
    category: input.category || 'Other',
    available: input.available !== false,
    sort_order: input.sort_order ?? getMenuItems().length,
  });
}

export function deleteMenuItem(itemId) {
  remove('menu_items', itemId);
}

/* ---------------------------------------------------------- open orders */

export function getOpenOrder(tableId) {
  return selectAll('open_orders').find(order => order.table_id === tableId) || null;
}

export function getOpenOrders() {
  return selectAll('open_orders');
}

export function getOrderItems(tableId) {
  return selectAll('order_items')
    .filter(item => item.table_id === tableId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function getOccupancyMap() {
  const map = {};
  selectAll('order_items').forEach(item => {
    map[item.table_id] = (map[item.table_id] || 0) + 1;
  });
  return map;
}

function ensureOpenOrder(tableId, userId) {
  const existing = getOpenOrder(tableId);
  if (existing) return existing;
  return upsert('open_orders', {
    id: uuid(),
    table_id: tableId,
    note: '',
    started_at: nowIso(),
    opened_by: userId || null,
  });
}

export function addMenuItemToTable(tableId, menuItem, userId) {
  const order = ensureOpenOrder(tableId, userId);
  const existing = getOrderItems(tableId).find(item => item.menu_item_id === menuItem.id && !item.note);
  if (existing) {
    return upsert('order_items', { ...existing, quantity: existing.quantity + 1 });
  }
  return upsert('order_items', {
    id: uuid(),
    order_id: order.id,
    table_id: tableId,
    menu_item_id: menuItem.id,
    name: menuItem.name,
    price: Number(menuItem.price) || 0,
    quantity: 1,
    note: '',
    created_by: userId || null,
    created_at: nowIso(),
  });
}

export function setItemQuantity(itemId, quantity) {
  const item = selectById('order_items', itemId);
  if (!item) return;
  if (quantity <= 0) {
    remove('order_items', itemId);
    return;
  }
  upsert('order_items', { ...item, quantity });
}

export function setItemNote(itemId, note) {
  const item = selectById('order_items', itemId);
  if (!item) return;
  upsert('order_items', { ...item, note });
}

export function removeItem(itemId) {
  remove('order_items', itemId);
}

export function setOrderNote(tableId, note, userId) {
  const order = ensureOpenOrder(tableId, userId);
  upsert('open_orders', { ...order, note });
}

export function clearTable(tableId) {
  getOrderItems(tableId).forEach(item => remove('order_items', item.id));
  const order = getOpenOrder(tableId);
  if (order) remove('open_orders', order.id);
}

export function clearAllTables() {
  selectAll('order_items').forEach(item => remove('order_items', item.id));
  selectAll('open_orders').forEach(order => remove('open_orders', order.id));
}

export function orderTotal(items) {
  return items.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

/* --------------------------------------------------------------- history */

export function finishOrder({ table, items, user, paymentMethod = 'cash' }) {
  const order = getOpenOrder(table.id);
  const startedAt = order?.started_at || nowIso();
  const finishedAt = nowIso();
  const entry = upsert('order_history', {
    id: uuid(),
    table_id: table.id,
    table_name: table.name,
    floor_id: table.floor_id,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 0,
      note: item.note || '',
    })),
    order_note: order?.note || '',
    started_at: startedAt,
    finished_at: finishedAt,
    day: toDateKey(startedAt),
    total_price: orderTotal(items),
    payment_method: paymentMethod,
    served_by: user?.id || null,
    served_by_name: user?.full_name || user?.email || 'Unknown',
  });
  clearTable(table.id);
  return entry;
}

export function getHistory() {
  return selectAll('order_history').sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
}

export function deleteHistoryEntry(entryId) {
  remove('order_history', entryId);
}

export function clearHistory() {
  selectAll('order_history').forEach(entry => remove('order_history', entry.id));
}

export function groupHistoryByDay(entries) {
  const groups = new Map();
  entries.forEach(entry => {
    const key = entry.day || toDateKey(entry.started_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return Array.from(groups.entries())
    .map(([day, list]) => ({
      day,
      entries: list,
      total: list.reduce((sum, entry) => sum + Number(entry.total_price || 0), 0),
      orders: list.length,
      items: list.reduce(
        (sum, entry) => sum + (entry.items || []).reduce((count, item) => count + Number(item.quantity || 0), 0),
        0
      ),
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function dayBreakdown(entries) {
  const byItem = new Map();
  const byCategory = new Map();
  const byStaff = new Map();
  const byHour = new Array(24).fill(0);
  const menu = getMenuItems();
  const categoryOf = name => menu.find(item => item.name === name)?.category || 'Other';

  entries.forEach(entry => {
    const staffKey = entry.served_by_name || 'Unknown';
    const staff = byStaff.get(staffKey) || { name: staffKey, orders: 0, total: 0, items: 0 };
    staff.orders += 1;
    staff.total += Number(entry.total_price || 0);
    byHour[new Date(entry.finished_at || entry.started_at).getHours()] += Number(entry.total_price || 0);

    (entry.items || []).forEach(item => {
      const quantity = Number(item.quantity || 0);
      const revenue = quantity * Number(item.price || 0);
      staff.items += quantity;

      const itemRow = byItem.get(item.name) || { name: item.name, quantity: 0, total: 0 };
      itemRow.quantity += quantity;
      itemRow.total += revenue;
      byItem.set(item.name, itemRow);

      const category = categoryOf(item.name);
      const catRow = byCategory.get(category) || { name: category, quantity: 0, total: 0 };
      catRow.quantity += quantity;
      catRow.total += revenue;
      byCategory.set(category, catRow);
    });
    byStaff.set(staffKey, staff);
  });

  const total = entries.reduce((sum, entry) => sum + Number(entry.total_price || 0), 0);
  return {
    total,
    orders: entries.length,
    average: entries.length ? total / entries.length : 0,
    items: Array.from(byItem.values()).sort((a, b) => b.total - a.total),
    categories: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
    staff: Array.from(byStaff.values()).sort((a, b) => b.total - a.total),
    hours: byHour,
  };
}

/* ---------------------------------------------------------------- shifts */

export function getShifts(userId) {
  const shifts = selectAll('shifts').sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
  return userId ? shifts.filter(shift => shift.user_id === userId) : shifts;
}

export function getActiveShift(userId) {
  return getShifts(userId).find(shift => !shift.clock_out) || null;
}

export function clockIn(user) {
  const active = getActiveShift(user.id);
  if (active) return active;
  return upsert('shifts', {
    id: uuid(),
    user_id: user.id,
    user_name: user.full_name || user.email,
    clock_in: nowIso(),
    clock_out: null,
    day: toDateKey(new Date()),
    note: '',
  });
}

export function clockOut(user) {
  const active = getActiveShift(user.id);
  if (!active) return null;
  return upsert('shifts', { ...active, clock_out: nowIso() });
}

export function saveShift(input) {
  return upsert('shifts', {
    id: input.id || uuid(),
    user_id: input.user_id,
    user_name: input.user_name,
    clock_in: input.clock_in,
    clock_out: input.clock_out || null,
    day: input.day || toDateKey(input.clock_in),
    note: input.note || '',
  });
}

export function deleteShift(shiftId) {
  remove('shifts', shiftId);
}

/* -------------------------------------------------------------- profiles */

export function getProfiles() {
  return selectAll('profiles').sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

export function saveProfile(input) {
  return upsert('profiles', {
    id: input.id,
    email: input.email,
    full_name: input.full_name,
    role: input.role === 'admin' ? 'admin' : 'employee',
    active: input.active !== false,
  });
}
