import { useEffect, useState } from 'react';

// useState that survives a reload via localStorage, for inputs that belong to
// this browser only (never the URL, so a shared link can't carry them).
// `sanitize` turns whatever was stored, possibly by an older version, into a
// valid value or the default.
export function usePersistentState<T>(
  key: string,
  initial: T,
  sanitize: (stored: unknown) => T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : sanitize(JSON.parse(stored));
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage unavailable (private mode / quota) — still works in-memory.
    }
  }, [key, value]);

  return [value, setValue];
}
