import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = normalizeUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

// The dashboard shows endpoint URLs like https://ref.supabase.co/rest/v1/, but
// supabase-js expects the bare project URL and appends the service path itself.
function normalizeUrl(value) {
  if (!value) return value;
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/(rest|auth|storage|realtime|functions)\/v\d+\/?$/, '')
    .replace(/\/+$/, '');
}

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

/**
 * Session-less client used to sign new staff up without replacing the
 * administrator's own session in storage.
 */
export function createIsolatedClient() {
  if (!isSupabaseConfigured) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
