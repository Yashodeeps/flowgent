// @flowgent/core/store — the headless, framework-agnostic state core.
//
// A versioned state container with a single mutation funnel. Every change runs
// through middleware (persistence, cross-tab sync, orphan/destructive gates),
// records inverse patches for undo, bumps the version, and notifies subscribers.
// No React, no AI — a canvas/doc/design editor uses this directly; the Wizard
// is just one consumer built on top.
//
//   mutate(recipe)
//     → produceWithPatches → { next, patches, inversePatches }
//     → middleware.beforeApply (a false return VETOES the mutation)
//     → commit next, version++
//     → history.record (coalesce + cap); clear redo
//     → middleware.afterApply (persist, broadcast)
//     → notify
//
//   undo()  → apply inversePatches (source 'undo', not re-recorded)
//   applyExternalPatches(patches) → apply remote/AI patches, NOT on the undo stack

import { applyPatches as immerApplyPatches, enablePatches, produceWithPatches } from 'immer';
import type { Patch } from 'immer';
import { History } from './undo.js';

// Enable Immer's patches plugin lazily (on first store creation) so this module
// has no import-time side effect and stays tree-shake-safe.
let patchesEnabled = false;
function ensurePatches(): void {
  if (!patchesEnabled) {
    enablePatches();
    patchesEnabled = true;
  }
}

// Immer's produceWithPatches/applyPatches are constrained to `Objectish`
// (object | array | map | set). Store state is always one of those, but a bare
// generic T isn't provably so — cast at this single boundary, typed helpers keep
// the rest of the file fully typed.
function produceT<T>(base: T, recipe: (draft: T) => void): [T, Patch[], Patch[]] {
  return produceWithPatches(base as never, recipe as never) as unknown as [T, Patch[], Patch[]];
}
function applyPatchesT<T>(base: T, patches: Patch[]): T {
  return immerApplyPatches(base as never, patches) as unknown as T;
}

export type { Patch };

export type MutationSource = 'local' | 'remote' | 'undo' | 'redo';

export interface MutationCtx<T> {
  prev: T;
  next: T;
  patches: Patch[];
  inversePatches: Patch[];
  source: MutationSource;
}

// A middleware hooks the mutation funnel. beforeApply may return false to veto
// (e.g. destructive-confirm holds the mutation until the user confirms).
export interface Middleware<T> {
  name: string;
  // Called once when the store is created, with the store itself — lets a
  // middleware push patches back in (cross-tab receive, destructive confirm).
  attach?(store: Store<T>): void;
  beforeApply?(ctx: MutationCtx<T>): boolean | void;
  afterApply?(ctx: MutationCtx<T>): void;
  destroy?(): void;
}

export interface StoreOptions<T> {
  initial: T;
  middleware?: Middleware<T>[];
  maxUndo?: number; // default 100
  coalesceMs?: number; // default 300
  now?: () => number; // injectable clock (coalesce window); default Date.now
}

export interface Store<T> {
  getState(): T;
  getVersion(): number;
  subscribe(listener: () => void): () => void;
  // Mutate via an Immer recipe. opts.coalesceKey merges rapid edits (a drag)
  // into one undo step.
  mutate(recipe: (draft: T) => void, opts?: { coalesceKey?: string }): void;
  // Apply patches from outside (cross-tab peer, AI proposal commit). These do
  // NOT go on the local undo stack.
  applyExternalPatches(patches: Patch[]): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  destroy(): void;
}

const DEFAULT_MAX_UNDO = 100;
const DEFAULT_COALESCE_MS = 300;

export function createStore<T>(options: StoreOptions<T>): Store<T> {
  ensurePatches();
  const middleware = options.middleware ?? [];
  const now = options.now ?? (() => Date.now());
  const history = new History(options.maxUndo ?? DEFAULT_MAX_UNDO, options.coalesceMs ?? DEFAULT_COALESCE_MS);

  let state = options.initial;
  let version = 0;
  let attached = false;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const l of listeners) l();
  }

  function runBefore(ctx: MutationCtx<T>): boolean {
    for (const mw of middleware) {
      if (mw.beforeApply?.(ctx) === false) return false;
    }
    return true;
  }
  function runAfter(ctx: MutationCtx<T>): void {
    for (const mw of middleware) mw.afterApply?.(ctx);
  }

  // Apply a precomputed transition. Returns false if a middleware vetoed it.
  function apply(
    next: T,
    patches: Patch[],
    inversePatches: Patch[],
    source: MutationSource,
  ): boolean {
    const ctx: MutationCtx<T> = { prev: state, next, patches, inversePatches, source };
    if (!runBefore(ctx)) return false;
    state = next;
    version += 1;
    runAfter(ctx);
    notify();
    return true;
  }

  const store: Store<T> = {
    getState: () => state,
    getVersion: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    mutate(recipe, opts) {
      const [next, patches, inversePatches] = produceT(state, recipe);
      if (patches.length === 0) return; // no-op recipe
      const applied = apply(next, patches, inversePatches, 'local');
      if (applied) {
        history.record({ patches, inversePatches, coalesceKey: opts?.coalesceKey, time: now() });
      }
    },

    applyExternalPatches(patches) {
      if (patches.length === 0) return;
      const next = applyPatchesT(state, patches);
      // Remote/AI patches are not locally undoable, so no history record.
      apply(next, patches, [], 'remote');
    },

    undo() {
      const entry = history.undo();
      if (!entry) return;
      const next = applyPatchesT(state, entry.inversePatches);
      apply(next, entry.inversePatches, entry.patches, 'undo');
    },

    redo() {
      const entry = history.redo();
      if (!entry) return;
      const next = applyPatchesT(state, entry.patches);
      apply(next, entry.patches, entry.inversePatches, 'redo');
    },

    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),

    destroy() {
      for (const mw of middleware) mw.destroy?.();
      history.clear();
      listeners.clear();
    },
  };

  // Give each middleware the store reference once (cross-tab/destructive need it).
  if (!attached) {
    attached = true;
    for (const mw of middleware) mw.attach?.(store);
  }

  return store;
}
