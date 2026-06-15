// Undo/redo: worked examples + a fast-check property test asserting that
// mutate→undo round-trips to the exact prior state over random sequences
// (decision 6). Also covers coalescing and the maxUndo cap (decision 7).

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createStore } from '../src/store/index.js';

interface Doc {
  m: Record<string, number>;
  list: string[];
}
const fresh = (): Doc => ({ m: {}, list: [] });

describe('undo/redo — examples', () => {
  it('undo reverts the last mutation; redo re-applies it', () => {
    const store = createStore<Doc>({ initial: fresh() });
    store.mutate((d) => {
      d.m.a = 1;
    });
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);

    store.undo();
    expect(store.getState().m).toEqual({});
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(true);

    store.redo();
    expect(store.getState().m).toEqual({ a: 1 });
  });

  it('undo a nested delete restores the exact prior state', () => {
    const store = createStore<Doc>({ initial: { m: { a: 1, b: 2, c: 3 }, list: [] } });
    store.mutate((d) => {
      delete d.m.b;
    });
    expect(store.getState().m).toEqual({ a: 1, c: 3 });
    store.undo();
    expect(store.getState().m).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('undo an array reorder restores order', () => {
    const store = createStore<Doc>({ initial: { m: {}, list: ['x', 'y', 'z'] } });
    store.mutate((d) => {
      d.list.reverse();
    });
    expect(store.getState().list).toEqual(['z', 'y', 'x']);
    store.undo();
    expect(store.getState().list).toEqual(['x', 'y', 'z']);
  });

  it('a fresh mutation clears the redo stack', () => {
    const store = createStore<Doc>({ initial: fresh() });
    store.mutate((d) => void (d.m.a = 1));
    store.undo();
    expect(store.canRedo()).toBe(true);
    store.mutate((d) => void (d.m.b = 2));
    expect(store.canRedo()).toBe(false);
  });

  it('undo/redo on an empty stack are no-ops', () => {
    const store = createStore<Doc>({ initial: fresh() });
    expect(() => {
      store.undo();
      store.redo();
    }).not.toThrow();
    expect(store.getState()).toEqual(fresh());
  });
});

describe('undo/redo — coalescing (decision 7)', () => {
  it('merges same-key mutations within the window into one undo step', () => {
    let t = 1000;
    const store = createStore<Doc>({ initial: fresh(), coalesceMs: 300, now: () => t });

    store.mutate((d) => void (d.m.x = 1), { coalesceKey: 'drag' });
    t = 1100;
    store.mutate((d) => void (d.m.x = 2), { coalesceKey: 'drag' });
    t = 1200;
    store.mutate((d) => void (d.m.x = 3), { coalesceKey: 'drag' });

    expect(store.getState().m.x).toBe(3);
    store.undo(); // one undo reverts the whole gesture
    expect(store.getState().m).toEqual({});
    expect(store.canUndo()).toBe(false);
  });

  it('does NOT merge once the coalesce window elapses', () => {
    let t = 0;
    const store = createStore<Doc>({ initial: fresh(), coalesceMs: 300, now: () => t });
    store.mutate((d) => void (d.m.x = 1), { coalesceKey: 'drag' });
    t = 1000; // past the window
    store.mutate((d) => void (d.m.x = 2), { coalesceKey: 'drag' });

    store.undo();
    expect(store.getState().m.x).toBe(1); // only the second reverted
    expect(store.canUndo()).toBe(true);
  });

  it('does not coalesce mutations without a coalesceKey', () => {
    const store = createStore<Doc>({ initial: fresh() });
    store.mutate((d) => void (d.m.a = 1));
    store.mutate((d) => void (d.m.b = 2));
    store.undo();
    expect(store.getState().m).toEqual({ a: 1 });
  });
});

describe('undo/redo — cap (decision 7)', () => {
  it('drops the oldest entry past maxUndo', () => {
    const store = createStore<Doc>({ initial: fresh(), maxUndo: 3 });
    for (let i = 0; i < 5; i++) store.mutate((d) => void (d.list.push(String(i))));
    // 5 mutations, cap 3 → only 3 undoable
    let undos = 0;
    while (store.canUndo()) {
      store.undo();
      undos++;
    }
    expect(undos).toBe(3);
    // the first two pushes survive (their entries were evicted, not reverted)
    expect(store.getState().list).toEqual(['0', '1']);
  });
});

describe('undo/redo — property: round-trip identity', () => {
  type Op = { type: 'set'; k: string; v: number } | { type: 'del'; k: string };
  const keyArb = fc.constantFrom('a', 'b', 'c', 'd');
  const opArb: fc.Arbitrary<Op> = fc.oneof(
    fc.record({ type: fc.constant('set' as const), k: keyArb, v: fc.integer({ min: 0, max: 9 }) }),
    fc.record({ type: fc.constant('del' as const), k: keyArb }),
  );

  it('undo then redo reproduces every intermediate state', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 25 }), (ops) => {
        const store = createStore<Doc>({ initial: fresh() });
        // Snapshot only states where a mutation actually applied (version moved).
        const snaps: Doc[] = [store.getState()];
        let v = store.getVersion();
        for (const op of ops) {
          store.mutate((d) => {
            if (op.type === 'set') d.m[op.k] = op.v;
            else delete d.m[op.k];
          });
          if (store.getVersion() !== v) {
            snaps.push(store.getState());
            v = store.getVersion();
          }
        }
        // Walk backwards: each undo must land on the previous snapshot.
        for (let i = snaps.length - 1; i >= 1; i--) {
          expect(store.getState()).toEqual(snaps[i]);
          store.undo();
          expect(store.getState()).toEqual(snaps[i - 1]);
        }
        // Walk forward: each redo must reproduce the next snapshot.
        for (let i = 1; i < snaps.length; i++) {
          store.redo();
          expect(store.getState()).toEqual(snaps[i]);
        }
      }),
      { numRuns: 200 },
    );
  });
});
