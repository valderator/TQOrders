import { Platform } from 'react-native';

const listeners = new Set();
let online = true;

if (Platform.OS === 'web' && typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
  online = globalThis.navigator ? globalThis.navigator.onLine !== false : true;
  globalThis.addEventListener('online', () => setOnline(true));
  globalThis.addEventListener('offline', () => setOnline(false));
}

function setOnline(next) {
  if (online === next) return;
  online = next;
  listeners.forEach(listener => {
    try {
      listener(next);
    } catch {
      /* listener errors must not break connectivity notifications */
    }
  });
}

export function isOnline() {
  return online;
}

/** Called by the sync engine so native platforms learn about connectivity from real requests. */
export function reportNetworkResult(success) {
  setOnline(!!success);
}

export function subscribeConnectivity(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
