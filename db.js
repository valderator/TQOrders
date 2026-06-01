import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAMPLE_MENU } from './data/menu';

const isWeb = Platform.OS === 'web';
const useLocalStorage = isWeb && typeof globalThis?.localStorage !== 'undefined';

const TABLES_KEY = 'cafeteria:tables';
const MENU_KEY = 'cafeteria:menu_items';
const ORDERS_KEY = 'cafeteria:orders';
const HISTORY_KEY = 'cafeteria:history';

function parseJson(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function getStorageData(key) {
  if (useLocalStorage) {
    const raw = globalThis.localStorage.getItem(key);
    return parseJson(raw, []);
  }

  const raw = await AsyncStorage.getItem(key);
  return parseJson(raw, []);
}

async function setStorageData(key, value) {
  if (useLocalStorage) {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

async function markTableStarted(tableId) {
  const tables = await getStorageData(TABLES_KEY);
  const index = tables.findIndex(table => table.id === tableId);
  if (index >= 0 && !tables[index].order_started_at) {
    tables[index].order_started_at = new Date().toISOString();
    await setStorageData(TABLES_KEY, tables);
  }
}

export async function initDb() {
  const existingTables = await getStorageData(TABLES_KEY);
  const DESIRED_TABLE_COUNT = 15;
  if (existingTables.length === 0) {
    const defaultTables = Array.from({ length: DESIRED_TABLE_COUNT }, (_, i) => `T${i + 1}`);
    const tables = defaultTables.map((name, index) => ({
      id: index + 1,
      name,
      status: 'open',
      note: '',
      order_started_at: null,
    }));
    await setStorageData(TABLES_KEY, tables);
  } else if (existingTables.length < DESIRED_TABLE_COUNT) {
    // Append missing tables without removing existing ones (migration)
    const missing = [];
    for (let i = existingTables.length + 1; i <= DESIRED_TABLE_COUNT; i++) {
      missing.push({
        id: i,
        name: `T${i}`,
        status: 'open',
        note: '',
        order_started_at: null,
      });
    }
    const merged = existingTables.concat(missing);
    await setStorageData(TABLES_KEY, merged);
  }

  // Normalize table names to match photo layout labels (id -> name)
  const PHOTO_NAMES = {
    1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4',
    5: 'BAR',
    6: 'S1', 7: 'S2', 8: 'S3', 9: 'S4',
    10: 'M5', 11: 'M6', 12: 'M7', 13: 'M8', 14: 'M9', 15: 'M10',
  };

  const finalTables = await getStorageData(TABLES_KEY);
  if (finalTables.length >= DESIRED_TABLE_COUNT) {
    const renamed = finalTables.map(t => ({ ...t, name: PHOTO_NAMES[t.id] || t.name }));
    await setStorageData(TABLES_KEY, renamed);
  }

  const existingMenu = await getStorageData(MENU_KEY);
  if (existingMenu.length === 0) {
    const menu = SAMPLE_MENU.map((item, index) => ({ id: index + 1, ...item }));
    await setStorageData(MENU_KEY, menu);
  }

  const existingOrders = await getStorageData(ORDERS_KEY);
  if (existingOrders.length === 0) {
    await setStorageData(ORDERS_KEY, []);
  }

  const existingHistory = await getStorageData(HISTORY_KEY);
  if (existingHistory.length === 0) {
    await setStorageData(HISTORY_KEY, []);
  }
}

export async function getTables() {
  return getStorageData(TABLES_KEY);
}

export async function getMenuItems() {
  return getStorageData(MENU_KEY);
}

export async function getOrdersForTable(tableId) {
  const orders = await getStorageData(ORDERS_KEY);
  const menuItems = await getStorageData(MENU_KEY);
  return orders
    .filter(order => order.table_id === tableId)
    .map(order => {
      const menuItem = menuItems.find(item => item.id === order.menu_item_id) || {};
      return {
        id: order.id,
        quantity: order.quantity,
        name: menuItem.name || 'Unknown item',
        price: menuItem.price || 0,
        note: order.note || '',
      };
    });
}

export async function saveOrderForTable(tableId, menuItemId) {
  await markTableStarted(tableId);
  const orders = await getStorageData(ORDERS_KEY);
  const existingIndex = orders.findIndex(order => order.table_id === tableId && order.menu_item_id === menuItemId);
  if (existingIndex >= 0) {
    orders[existingIndex].quantity += 1;
  } else {
    orders.push({
      id: nextId(orders),
      table_id: tableId,
      menu_item_id: menuItemId,
      quantity: 1,
      created_at: new Date().toISOString(),
    });
  }
  await setStorageData(ORDERS_KEY, orders);
}

export async function updateOrderQuantity(orderId, quantity) {
  const orders = await getStorageData(ORDERS_KEY);
  const index = orders.findIndex(order => order.id === orderId);
  if (index >= 0) {
    await markTableStarted(orders[index].table_id);
    orders[index].quantity = quantity;
    await setStorageData(ORDERS_KEY, orders);
  }
}

export async function updateOrderNote(orderId, note) {
  const orders = await getStorageData(ORDERS_KEY);
  const index = orders.findIndex(order => order.id === orderId);
  if (index >= 0) {
    await markTableStarted(orders[index].table_id);
    orders[index].note = note;
    await setStorageData(ORDERS_KEY, orders);
  }
}

export async function setTableNote(tableId, note) {
  const tables = await getStorageData(TABLES_KEY);
  const index = tables.findIndex(table => table.id === tableId);
  if (index >= 0) {
    await markTableStarted(tableId);
    tables[index].note = note;
    await setStorageData(TABLES_KEY, tables);
  }
}

export async function clearTableNote(tableId) {
  const tables = await getStorageData(TABLES_KEY);
  const index = tables.findIndex(table => table.id === tableId);
  if (index >= 0) {
    tables[index].note = '';
    await setStorageData(TABLES_KEY, tables);
  }
}

export async function clearAllTables() {
  await setStorageData(ORDERS_KEY, []);
  const tables = await getStorageData(TABLES_KEY);
  const updatedTables = tables.map(table => ({
    ...table,
    note: '',
    order_started_at: null,
  }));
  await setStorageData(TABLES_KEY, updatedTables);
}

export async function getHistory() {
  return getStorageData(HISTORY_KEY);
}

export async function addHistoryEntry(entry) {
  const history = await getStorageData(HISTORY_KEY);
  history.push({ id: nextId(history), ...entry });
  await setStorageData(HISTORY_KEY, history);
}

export async function closeTableById(tableId) {
  const tables = await getStorageData(TABLES_KEY);
  const index = tables.findIndex(table => table.id === tableId);
  if (index >= 0) {
    tables[index].status = 'closed';
    await setStorageData(TABLES_KEY, tables);
  }
}

export async function removeOrderItem(orderId) {
  const orders = await getStorageData(ORDERS_KEY);
  const nextOrders = orders.filter(order => order.id !== orderId);
  await setStorageData(ORDERS_KEY, nextOrders);
}

export async function clearOrdersForTable(tableId) {
  const orders = await getStorageData(ORDERS_KEY);
  const nextOrders = orders.filter(order => order.table_id !== tableId);
  await setStorageData(ORDERS_KEY, nextOrders);
  const tables = await getStorageData(TABLES_KEY);
  const index = tables.findIndex(table => table.id === tableId);
  if (index >= 0) {
    tables[index].order_started_at = null;
    await setStorageData(TABLES_KEY, tables);
  }
}
