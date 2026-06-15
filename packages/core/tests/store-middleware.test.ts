// Store middleware: persist (debounce + never-auto-resume), cross-tab sync,
// destructive-confirm gate.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/store/index.js';
import {
  clearPersisted,
  loadPersisted,
  persist,
} from '../src/store/middleware/persist.js';
import { crossTab } from '../src/store/middleware/cross-tab.js';
import { destructiveGate, type DestructiveHold } from '../src/store/middleware/destructive.js';
import { inMemoryAdapter, MockBroadcastChannel } from './helpers.js';

interface S {
  count: number;
  other: number;
}
const init = (): S => ({ count: 0, other: 0 });

describe('persist middleware (Pattern 1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces writes into one storage write per window', () => {
    const adapter = inMemoryAdapter();
    const write = vi.spyOn(adapter, 'write');
    const store = createStore<S>({
      initial: init(),
      middleware: [persist({ key: 'k', adapter, debounceMs: 150 })],
    });
    store.mutate((d) => void (d.count = 1));
    store.mutate((d) => void (d.count = 2));
    store.mutate((d) => void (d.count = 3));
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(write.mock.calls[0]![1]).count).toBe(3);
  });

  it('flushes the pending write on beforeunload', () => {
    const adapter = inMemoryAdapter();
    const write = vi.spyOn(adapter, 'write');
    createStore<S>({ initial: init(), middleware: [persist({ key: 'k', adapter, debounceMs: 150 })] }).mutate(
      (d) => void (d.count = 1),
    );
    expect(write).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('beforeunload'));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('persists the draft but never auto-resumes it (caller decides)', () => {
    const adapter = inMemoryAdapter();
    const a = createStore<S>({ initial: init(), middleware: [persist({ key: 'k', adapter, debounceMs: 0 })] });
    a.mutate((d) => void (d.count = 7));
    vi.advanceTimersByTime(0);

    // A new store starts from its own initial — NOT the persisted draft.
    const b = createStore<S>({ initial: init(), middleware: [persist({ key: 'k', adapter, debounceMs: 0 })] });
    expect(b.getState().count).toBe(0);
    // The draft is readable only on explicit request.
    expect(loadPersisted<S>('k', adapter)?.count).toBe(7);

    clearPersisted('k', adapter);
    expect(loadPersisted<S>('k', adapter)).toBeNull();
  });
});

describe('cross-tab middleware', () => {
  it('propagates a local mutation to a peer store', () => {
    const a = createStore<S>({
      initial: init(),
      middleware: [crossTab({ channel: 'c', factory: (n) => new MockBroadcastChannel(n) })],
    });
    const b = createStore<S>({
      initial: init(),
      middleware: [crossTab({ channel: 'c', factory: (n) => new MockBroadcastChannel(n) })],
    });
    a.mutate((d) => void (d.count = 5));
    expect(b.getState().count).toBe(5);
    expect(a.getVersion()).toBe(1);
    expect(b.getVersion()).toBe(1); // applied once, no echo loop
    a.destroy();
    b.destroy();
  });

  it('a peer-applied change is not on the local undo stack', () => {
    const a = createStore<S>({
      initial: init(),
      middleware: [crossTab({ channel: 'c2', factory: (n) => new MockBroadcastChannel(n) })],
    });
    const b = createStore<S>({
      initial: init(),
      middleware: [crossTab({ channel: 'c2', factory: (n) => new MockBroadcastChannel(n) })],
    });
    a.mutate((d) => void (d.count = 1));
    expect(b.getState().count).toBe(1);
    expect(b.canUndo()).toBe(false);
    a.destroy();
    b.destroy();
  });

  it('falls back gracefully when no channel is available', () => {
    const store = createStore<S>({
      initial: init(),
      middleware: [crossTab({ channel: 'c3', factory: () => null })],
    });
    expect(() => store.mutate((d) => void (d.count = 1))).not.toThrow();
    expect(store.getState().count).toBe(1);
  });
});

describe('destructive gate (Pattern 5)', () => {
  it('vetoes a destructive mutation and holds it until confirm()', () => {
    let hold: DestructiveHold | null = null;
    const store = createStore<S>({
      initial: init(),
      middleware: [
        destructiveGate<S>({ isDestructive: (ctx) => ctx.next.count < 0, onHold: (h) => void (hold = h) }),
      ],
    });
    store.mutate((d) => void (d.count = -1)); // destructive → held
    expect(store.getState().count).toBe(0);
    expect(store.getVersion()).toBe(0);
    expect(hold).not.toBeNull();

    hold!.confirm();
    expect(store.getState().count).toBe(-1);
    expect(store.getVersion()).toBe(1);
  });

  it('cancel() leaves the state unchanged', () => {
    let hold: DestructiveHold | null = null;
    const store = createStore<S>({
      initial: init(),
      middleware: [destructiveGate<S>({ isDestructive: () => true, onHold: (h) => void (hold = h) })],
    });
    store.mutate((d) => void (d.count = 9));
    hold!.cancel();
    expect(store.getState().count).toBe(0);
    expect(store.getVersion()).toBe(0);
  });

  it('lets non-destructive mutations through', () => {
    const onHold = vi.fn();
    const store = createStore<S>({
      initial: init(),
      middleware: [destructiveGate<S>({ isDestructive: () => false, onHold })],
    });
    store.mutate((d) => void (d.count = 3));
    expect(store.getState().count).toBe(3);
    expect(onHold).not.toHaveBeenCalled();
  });
});
