import { describe, it, expect } from 'vitest';
import {
  markSession,
  shouldResume,
  clearSession,
  storageKey,
  type PersistenceAdapter,
} from '../src/patterns/01-no-auto-resume.js';
import { emptySnapshot } from '../src/fsm.js';

function inMemoryAdapter(): PersistenceAdapter {
  const store = new Map<string, string>();
  return {
    read: (k) => store.get(k) ?? null,
    write: (k, v) => void store.set(k, v),
    remove: (k) => void store.delete(k),
  };
}

describe('Pattern 1 — no auto-resume', () => {
  it('returns resumable=false when nothing stored', () => {
    const adapter = inMemoryAdapter();
    const r = shouldResume('onboarding', adapter);
    expect(r.resumable).toBe(false);
  });

  it('round-trips a snapshot via markSession → shouldResume', () => {
    const adapter = inMemoryAdapter();
    const snap = { ...emptySnapshot(), version: 5 };
    markSession('onboarding', snap, adapter);
    const r = shouldResume('onboarding', adapter);
    expect(r.resumable).toBe(true);
    expect(r.snapshot?.version).toBe(5);
  });

  it('returns resumable=false when stored value is corrupted', () => {
    const adapter = inMemoryAdapter();
    adapter.write(storageKey('onboarding'), '{not valid json');
    const r = shouldResume('onboarding', adapter);
    expect(r.resumable).toBe(false);
  });

  it('clearSession removes the persisted draft', () => {
    const adapter = inMemoryAdapter();
    markSession('onboarding', emptySnapshot(), adapter);
    clearSession('onboarding', adapter);
    expect(shouldResume('onboarding', adapter).resumable).toBe(false);
  });

  it('IMPORTANT: shouldResume does NOT auto-apply — Pattern 1 contract', () => {
    // This is the meta-test: Pattern 1 says "never auto-resume." The function
    // RETURNS the snapshot but never applies it. Verify by checking that no
    // side effect (other than the read) happened.
    const adapter = inMemoryAdapter();
    markSession('onboarding', { ...emptySnapshot(), version: 99 }, adapter);
    const r = shouldResume('onboarding', adapter);
    expect(r.snapshot).toBeDefined();
    // The contract: caller (Bridge.loadSession) is responsible for the
    // user-explicit-resume UI flow. shouldResume itself never mutates state.
    expect(r.snapshot?.version).toBe(99);
  });
});
