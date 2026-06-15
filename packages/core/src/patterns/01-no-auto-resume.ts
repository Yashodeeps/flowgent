// Pattern 1: persist the draft, never auto-resume it.
//
// Contract:
//   - Bridge calls saveSession() after every patch (debounced per EX10).
//   - loadSession() returns the persisted snapshot but the bridge MUST NOT
//     apply it automatically. Instead, the UI surfaces a "Resume previous
//     session" CTA and the user explicitly opts in.
//   - markSession() stamps a session-id on the snapshot so cross-tab sync
//     (EX5) can detect "same wizard, different tab" vs. "different wizard".
//
// This file is canonical — bridge.ts imports from here. Per design doc inversion.

import type { Snapshot } from '../types.js';

export interface PersistenceAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

// Default adapter: localStorage. Tests inject in-memory adapters.
export const localStorageAdapter: PersistenceAdapter = {
  read: (key) => (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  write: (key, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  remove: (key) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const KEY_PREFIX = 'flowgent:';

export function storageKey(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}:snapshot`;
}

export function shouldResume(
  sessionId: string,
  adapter: PersistenceAdapter = localStorageAdapter,
): { resumable: boolean; snapshot?: Snapshot } {
  const raw = adapter.read(storageKey(sessionId));
  if (!raw) return { resumable: false };
  try {
    const parsed = JSON.parse(raw) as Snapshot;
    if (typeof parsed.version !== 'number') return { resumable: false };
    return { resumable: true, snapshot: parsed };
  } catch {
    // Corrupted draft — treat as not-resumable. UI shows fresh start.
    return { resumable: false };
  }
}

export function markSession(
  sessionId: string,
  snapshot: Snapshot,
  adapter: PersistenceAdapter = localStorageAdapter,
): void {
  adapter.write(storageKey(sessionId), JSON.stringify(snapshot));
}

export function clearSession(
  sessionId: string,
  adapter: PersistenceAdapter = localStorageAdapter,
): void {
  adapter.remove(storageKey(sessionId));
}
