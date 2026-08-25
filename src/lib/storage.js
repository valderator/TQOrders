import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const hasLocalStorage =
  Platform.OS === 'web' && typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';

export const storage = {
  async getItem(key) {
    if (hasLocalStorage) return globalThis.localStorage.getItem(key);
    return AsyncStorage.getItem(key);
  },
  async setItem(key, value) {
    if (hasLocalStorage) {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (hasLocalStorage) {
      globalThis.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

export async function readJson(key, fallback) {
  try {
    const raw = await storage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJson(key, value) {
  await storage.setItem(key, JSON.stringify(value));
}
