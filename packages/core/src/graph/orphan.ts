// Orphan detection (Pattern 4) as graph middleware.
//
// After any mutation, find edges whose parent entity no longer exists — the
// child is "orphaned" (the thing it hung off of is gone). Report-only: it calls
// onOrphan so the consumer decides what to do (the Wizard skips the dependent
// question and shows a toast). It never mutates state itself, so there's no
// re-entrancy into the funnel.

import type { Middleware, MutationCtx } from '../store/index.js';
import type { EntityId, GraphState } from './index.js';

export interface OrphanInfo {
  orphanId: EntityId; // the child left dangling
  missingParentId: EntityId; // the parent that was removed
}

export interface OrphanOptions {
  onOrphan?(orphans: OrphanInfo[], state: GraphState): void;
}

// Pure helper: list children whose parent edge points at a missing entity.
export function findOrphans(state: GraphState): OrphanInfo[] {
  const orphans: OrphanInfo[] = [];
  for (const [parent, child] of state.edges) {
    if (!state.entities[parent]) {
      orphans.push({ orphanId: child, missingParentId: parent });
    }
  }
  return orphans;
}

export function orphanMiddleware<S extends GraphState>(opts: OrphanOptions = {}): Middleware<S> {
  return {
    name: 'orphan',
    afterApply(ctx: MutationCtx<S>) {
      // Only entity removals can create orphans — cheap guard before scanning.
      const removedEntity = ctx.patches.some(
        (p) => p.op === 'remove' && p.path[0] === 'entities',
      );
      if (!removedEntity) return;
      const orphans = findOrphans(ctx.next);
      if (orphans.length > 0) opts.onOrphan?.(orphans, ctx.next);
    },
  };
}
