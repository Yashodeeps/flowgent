// Destructive-action confirmation middleware (Pattern 5).
//
// beforeApply intercepts a LOCAL mutation the consumer flags as destructive,
// vetoes it, and hands the consumer a hold with confirm()/cancel(). confirm()
// re-applies the same patches via applyExternalPatches (source 'remote'), which
// bypasses this gate so it commits without re-prompting. Remote/undo/redo
// mutations are never gated — only direct user actions.

import type { Middleware, MutationCtx, Patch, Store } from '../index.js';

export interface DestructiveHold {
  patches: Patch[];
  confirm(): void;
  cancel(): void;
}

export interface DestructiveOptions<T> {
  isDestructive(ctx: MutationCtx<T>): boolean;
  onHold(hold: DestructiveHold): void;
}

export function destructiveGate<T>(opts: DestructiveOptions<T>): Middleware<T> {
  let store: Store<T> | null = null;

  return {
    name: 'destructive',
    attach(s) {
      store = s;
    },
    beforeApply(ctx: MutationCtx<T>) {
      if (ctx.source !== 'local') return; // gate only direct user actions
      if (!opts.isDestructive(ctx)) return;
      const patches = ctx.patches;
      let settled = false;
      opts.onHold({
        patches,
        confirm: () => {
          if (settled) return;
          settled = true;
          store?.applyExternalPatches(patches); // bypasses this gate (source 'remote')
        },
        cancel: () => {
          settled = true;
        },
      });
      return false; // hold the mutation until confirm()
    },
  };
}
