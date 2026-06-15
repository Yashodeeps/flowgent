// Store core: mutate funnel, middleware pipeline (ordered + veto), external patches.

import { describe, expect, it, vi } from 'vitest';
import { createStore, type Middleware, type MutationCtx } from '../src/store/index.js';

interface S {
  count: number;
  items: Record<string, { label: string }>;
}
const initial = (): S => ({ count: 0, items: {} });

describe('createStore — mutate funnel', () => {
  it('starts at the initial state, version 0', () => {
    const store = createStore<S>({ initial: initial() });
    expect(store.getState()).toEqual({ count: 0, items: {} });
    expect(store.getVersion()).toBe(0);
  });

  it('applies a recipe, bumps version, notifies subscribers', () => {
    const store = createStore<S>({ initial: initial() });
    const listener = vi.fn();
    store.subscribe(listener);

    store.mutate((d) => {
      d.count = 5;
      d.items.a = { label: 'A' };
    });

    expect(store.getState().count).toBe(5);
    expect(store.getState().items.a).toEqual({ label: 'A' });
    expect(store.getVersion()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('treats a no-op recipe as nothing (no version bump, no notify)', () => {
    const store = createStore<S>({ initial: initial() });
    const listener = vi.fn();
    store.subscribe(listener);
    store.mutate(() => {
      /* touches nothing */
    });
    expect(store.getVersion()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not mutate the previous state object (immutability)', () => {
    const store = createStore<S>({ initial: initial() });
    const before = store.getState();
    store.mutate((d) => {
      d.count = 9;
    });
    expect(before.count).toBe(0); // old reference unchanged
    expect(store.getState()).not.toBe(before);
  });

  it('unsubscribes cleanly', () => {
    const store = createStore<S>({ initial: initial() });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.mutate((d) => {
      d.count = 1;
    });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createStore — middleware pipeline', () => {
  it('runs beforeApply then afterApply, in registration order', () => {
    const calls: string[] = [];
    const mw = (name: string): Middleware<S> => ({
      name,
      beforeApply: () => void calls.push(`before:${name}`),
      afterApply: () => void calls.push(`after:${name}`),
    });
    const store = createStore<S>({ initial: initial(), middleware: [mw('one'), mw('two')] });
    store.mutate((d) => {
      d.count = 1;
    });
    expect(calls).toEqual(['before:one', 'before:two', 'after:one', 'after:two']);
  });

  it('beforeApply returning false vetoes the mutation (state + version unchanged)', () => {
    const gate: Middleware<S> = {
      name: 'gate',
      beforeApply: (ctx: MutationCtx<S>) => (ctx.next.count > 3 ? false : undefined),
    };
    const after = vi.fn();
    const store = createStore<S>({
      initial: initial(),
      middleware: [gate, { name: 'observe', afterApply: after }],
    });

    store.mutate((d) => {
      d.count = 2;
    });
    expect(store.getState().count).toBe(2);

    store.mutate((d) => {
      d.count = 10;
    }); // vetoed
    expect(store.getState().count).toBe(2); // unchanged
    expect(store.getVersion()).toBe(1); // only the first applied
    expect(after).toHaveBeenCalledTimes(1); // afterApply skipped on veto
    expect(store.canUndo()).toBe(true);
  });

  it('afterApply receives the mutation context with source', () => {
    let seen: MutationCtx<S> | null = null;
    const store = createStore<S>({
      initial: initial(),
      middleware: [{ name: 'spy', afterApply: (ctx) => void (seen = ctx) }],
    });
    store.mutate((d) => {
      d.count = 7;
    });
    expect(seen!.source).toBe('local');
    expect(seen!.prev.count).toBe(0);
    expect(seen!.next.count).toBe(7);
    expect(seen!.patches.length).toBeGreaterThan(0);
    expect(seen!.inversePatches.length).toBeGreaterThan(0);
  });

  it('calls middleware.destroy() on store.destroy()', () => {
    const destroy = vi.fn();
    const store = createStore<S>({ initial: initial(), middleware: [{ name: 'm', destroy }] });
    store.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe('createStore — applyExternalPatches', () => {
  it('applies remote patches but does NOT put them on the undo stack', () => {
    const store = createStore<S>({ initial: initial() });
    store.applyExternalPatches([{ op: 'replace', path: ['count'], value: 42 }]);
    expect(store.getState().count).toBe(42);
    expect(store.getVersion()).toBe(1);
    expect(store.canUndo()).toBe(false); // remote change is not locally undoable
  });

  it('marks external mutations with source "remote"', () => {
    let source = '';
    const store = createStore<S>({
      initial: initial(),
      middleware: [{ name: 'spy', afterApply: (ctx) => void (source = ctx.source) }],
    });
    store.applyExternalPatches([{ op: 'replace', path: ['count'], value: 1 }]);
    expect(source).toBe('remote');
  });
});
