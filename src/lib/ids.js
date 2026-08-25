import * as Crypto from 'expo-crypto';

export function uuid() {
  if (typeof globalThis?.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  if (typeof Crypto?.randomUUID === 'function') {
    return Crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function nowIso() {
  return new Date().toISOString();
}
