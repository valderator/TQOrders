import { readJson, writeJson } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isOnline, reportNetworkResult, subscribeConnectivity } from '../lib/connectivity';
import { nowIso } from '../lib/ids';

export const COLLECTIONS = {
  profiles: 'profiles',
  floors: 'floors',
  dining_tables: 'dining_tables',
  menu_categories: 'menu_categories',
  menu_items: 'menu_items',
  open_orders: 'open_orders',
  order_items: 'order_items',
  order_history: 'order_history',
  shifts: 'shifts',
};

const CACHE_KEY = 'tq:cache:v2';
const OUTBOX_KEY = 'tq:outbox:v2';
const HISTORY_WINDOW_DAYS = 180;

const emptyCache = () =>
  Object.keys(COLLECTIONS).reduce((acc, name) => {
    acc[name] = {};
    return acc;
  }, {});

let cache = emptyCache();
let outbox = [];
let version = 0;
let hydrated = false;
let syncing = false;
let syncState = { status: 'idle', pendingCount: 0, lastSyncedAt: null, error: null };
const listeners = new Set();
let persistTimer = null;
let realtimeChannel = null;

function emit() {
  version += 1;
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      /* a broken subscriber must not stop the others */
    }
  });
}

export function getVersion() {
  return version;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeJson(CACHE_KEY, cache);
    writeJson(OUTBOX_KEY, outbox);
  }, 150);
}

function setSyncState(patch) {
  syncState = { ...syncState, ...patch, pendingCount: outbox.length };
  emit();
}

export function getSyncState() {
  return syncState;
}

export async function hydrate() {
  if (hydrated) return;
  const [storedCache, storedOutbox] = await Promise.all([
    readJson(CACHE_KEY, null),
    readJson(OUTBOX_KEY, []),
  ]);
  cache = { ...emptyCache(), ...(storedCache || {}) };
  Object.keys(COLLECTIONS).forEach(name => {
    if (!cache[name]) cache[name] = {};
  });
  outbox = Array.isArray(storedOutbox) && isSupabaseConfigured ? storedOutbox : [];
  hydrated = true;
  setSyncState({});
}

export function selectAll(collection) {
  const bucket = cache[collection] || {};
  return Object.values(bucket).filter(record => !record.__deleted);
}

export function selectById(collection, id) {
  const record = (cache[collection] || {})[id];
  return record && !record.__deleted ? record : null;
}

function writeLocal(collection, record) {
  if (!cache[collection]) cache[collection] = {};
  cache[collection][record.id] = record;
}

/** Local-first write: updates the cache immediately, queues a remote upsert. */
export function upsert(collection, patch) {
  const existing = (cache[collection] || {})[patch.id] || {};
  const record = { ...existing, ...patch, updated_at: patch.updated_at || nowIso() };
  delete record.__deleted;
  writeLocal(collection, record);
  enqueue({ collection, op: 'upsert', payload: stripLocalFields(record) });
  schedulePersist();
  emit();
  return record;
}

/** Writes a record straight to the cache without queueing a remote push. */
export function putLocal(collection, record) {
  writeLocal(collection, { ...record, __remote: true });
  schedulePersist();
  emit();
}

export function remove(collection, id) {
  const existing = (cache[collection] || {})[id];
  if (existing) {
    writeLocal(collection, { ...existing, __deleted: true, updated_at: nowIso() });
  }
  enqueue({ collection, op: 'delete', payload: { id } });
  schedulePersist();
  emit();
}

/** Applies remote rows without re-queueing them for upload. */
function applyRemote(collection, rows) {
  rows.forEach(row => {
    const existing = (cache[collection] || {})[row.id];
    if (existing && !existing.__remote && new Date(existing.updated_at || 0) > new Date(row.updated_at || 0)) {
      return; // local pending change is newer
    }
    if (row.deleted_at) {
      writeLocal(collection, { ...row, __deleted: true, __remote: true });
      return;
    }
    writeLocal(collection, { ...row, __remote: true });
  });
}

function stripLocalFields(record) {
  const copy = { ...record };
  delete copy.__deleted;
  delete copy.__remote;
  return copy;
}

function enqueue(entry) {
  if (!isSupabaseConfigured) return; // local-only install: nothing to upload
  if (entry.op === 'upsert') {
    const index = outbox.findIndex(
      item => item.collection === entry.collection && item.op === 'upsert' && item.payload.id === entry.payload.id
    );
    if (index >= 0) {
      outbox[index] = { ...entry, queued_at: nowIso() };
      setSyncState({});
      return;
    }
  }
  outbox.push({ ...entry, queued_at: nowIso() });
  setSyncState({});
}

export function seedIfEmpty(collection, records) {
  const bucket = cache[collection] || {};
  if (Object.keys(bucket).length > 0) return false;
  records.forEach(record => upsert(collection, record));
  return true;
}

async function push() {
  if (!supabase || outbox.length === 0) return;
  while (outbox.length > 0) {
    const entry = outbox[0];
    const table = COLLECTIONS[entry.collection];
    let error = null;
    if (entry.op === 'upsert') {
      ({ error } = await supabase.from(table).upsert(entry.payload));
    } else {
      ({ error } = await supabase.from(table).delete().eq('id', entry.payload.id));
    }
    if (error) {
      if (isPermissionError(error)) {
        // The server rejected the change for good (RLS / validation): drop it so
        // the queue does not block forever, and refresh from the server.
        outbox.shift();
        setSyncState({ error: error.message });
        continue;
      }
      throw error;
    }
    outbox.shift();
    setSyncState({});
  }
  schedulePersist();
}

function isPermissionError(error) {
  const code = String(error?.code || '');
  return code.startsWith('42') || code === 'PGRST301' || code === '23503';
}

async function pull() {
  if (!supabase) return;
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400000).toISOString();
  const queries = Object.keys(COLLECTIONS).map(async name => {
    let query = supabase.from(COLLECTIONS[name]).select('*');
    if (name === 'order_history') query = query.gte('started_at', since);
    const { data, error } = await query;
    if (error) throw error;
    applyRemote(name, data || []);
  });
  await Promise.all(queries);
  schedulePersist();
  emit();
}

export async function sync({ force = false } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    setSyncState({ status: 'local-only' });
    return;
  }
  if (syncing && !force) return;
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    setSyncState({ status: 'signed-out' });
    return;
  }
  syncing = true;
  setSyncState({ status: 'syncing', error: null });
  try {
    await push();
    await pull();
    reportNetworkResult(true);
    setSyncState({ status: 'synced', lastSyncedAt: nowIso(), error: null });
  } catch (error) {
    const offline = /network|fetch|failed to fetch|timeout/i.test(String(error?.message || ''));
    if (offline) reportNetworkResult(false);
    setSyncState({ status: offline ? 'offline' : 'error', error: error?.message || String(error) });
  } finally {
    syncing = false;
  }
}

let intervalId = null;
let connectivityUnsub = null;

export function startSyncLoop(intervalMs = 20000) {
  stopSyncLoop();
  if (!isSupabaseConfigured) {
    setSyncState({ status: 'local-only' });
    return;
  }
  sync();
  intervalId = setInterval(() => {
    if (isOnline()) sync();
  }, intervalMs);
  connectivityUnsub = subscribeConnectivity(online => {
    if (online) sync();
    else setSyncState({ status: 'offline' });
  });
  startRealtime();
}

export function stopSyncLoop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  if (connectivityUnsub) connectivityUnsub();
  connectivityUnsub = null;
  stopRealtime();
}

function startRealtime() {
  if (!supabase || realtimeChannel) return;
  realtimeChannel = supabase.channel('tq-realtime');
  Object.keys(COLLECTIONS).forEach(name => {
    realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS[name] }, payload => {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (id && cache[name]?.[id]) {
          writeLocal(name, { ...cache[name][id], __deleted: true, __remote: true });
        }
      } else if (payload.new) {
        applyRemote(name, [payload.new]);
      }
      schedulePersist();
      emit();
    });
  });
  realtimeChannel.subscribe();
}

function stopRealtime() {
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

export async function resetLocalCache() {
  cache = emptyCache();
  outbox = [];
  await writeJson(CACHE_KEY, cache);
  await writeJson(OUTBOX_KEY, outbox);
  setSyncState({ status: 'idle', lastSyncedAt: null, error: null });
}
