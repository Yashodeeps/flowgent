// Persistence middleware (Pattern 1: persist the draft, never auto-resume).
//
// afterApply writes the full serialized state to storage, debounced. The draft
// is readable via loadPersisted(), but the CONSUMER decides whether to resume —
// the store never auto-applies a persisted draft.

import type { Middleware, MutationCtx } from '../index.js';

export interface PersistAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export const localStorageAdapter: PersistAdapter = {
  read: (key) => (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  write: (key, value) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  remove: (key) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export interface PersistOptions {
  key: string;
  adapter?: PersistAdapter;
  debounceMs?: number; // default 150
  serialize?: (state: unknown) => string;
}

const DEFAULT_DEBOUNCE_MS = 150;

export function persist<T>(opts: PersistOptions): Middleware<T> {
  const adapter = opts.adapter ?? localStorageAdapter;
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const serialize = opts.serialize ?? ((s: unknown) => JSON.stringify(s));

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | undefined;
  let hasPending = false;

  function flush(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (hasPending) {
      adapter.write(opts.key, serialize(pending));
      hasPending = false;
      pending = undefined;
    }
  }

  const onUnload = () => flush();
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', onUnload);

  return {
    name: 'persist',
    afterApply(ctx: MutationCtx<T>) {
      pending = ctx.next;
      hasPending = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    destroy() {
      flush();
      if (typeof window !== 'undefined') window.removeEventListener('beforeunload', onUnload);
    },
  };
}

// Pattern 1: read the persisted draft. Returns it; never applies it — the caller
// drives the explicit "resume previous session?" flow.
export function loadPersisted<T>(
  key: string,
  adapter: PersistAdapter = localStorageAdapter,
): T | null {
  const raw = adapter.read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null; // corrupted draft → fresh start
  }
}

export function clearPersisted(
  key: string,
  adapter: PersistAdapter = localStorageAdapter,
): void {
  adapter.remove(key);
}
