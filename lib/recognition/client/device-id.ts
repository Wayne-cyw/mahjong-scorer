const STORAGE_KEY = 'mahjong.deviceId';
/** Same shape the route accepts for `x-device-id`. */
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

let cached: string | null = null;

const generate = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * An anonymous random id used only so the route can rate limit per device. Persisted in
 * localStorage when it is available, otherwise kept in memory for the page's lifetime.
 */
export function getDeviceId(): string {
  if (cached) return cached;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.test(stored)) {
      cached = stored;
      return stored;
    }
  } catch {
    // Storage blocked: fall through to an in-memory id.
  }
  const id = generate();
  cached = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not persisted; the in-memory id still works.
  }
  return id;
}

/** Drops the in-memory cache so tests can exercise a fresh page load. */
export function resetDeviceIdForTests(): void {
  cached = null;
}
