// Cross-tab sync middleware (single user, multiple tabs).
//
// afterApply broadcasts the patches of every local/undo/redo change; incoming
// peer patches are applied via store.applyExternalPatches (which does NOT re-add
// them to the local undo stack and does NOT re-broadcast — no echo loop).
//
// This is the seam where a future multiplayer transport (Yjs/websocket) would
// plug in: swap BroadcastChannel for a network channel, same patch protocol.

import type { Middleware, MutationCtx, Patch, Store } from '../index.js';

export interface BroadcastChannelLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  close(): void;
}

export interface CrossTabOptions {
  channel: string;
  // Test/transport injection. Return null to disable cross-tab (graceful fallback).
  factory?: (name: string) => BroadcastChannelLike | null;
}

function defaultFactory(name: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(name);
}

interface PatchMessage {
  kind: 'patches';
  patches: Patch[];
}

export function crossTab<T>(opts: CrossTabOptions): Middleware<T> {
  const factory = opts.factory ?? defaultFactory;
  let channel: BroadcastChannelLike | null = null;
  let store: Store<T> | null = null;

  const onMessage = (e: MessageEvent) => {
    const msg = e.data as PatchMessage | undefined;
    if (msg?.kind === 'patches' && Array.isArray(msg.patches) && store) {
      store.applyExternalPatches(msg.patches); // source 'remote' → not re-broadcast
    }
  };

  return {
    name: 'cross-tab',
    attach(s) {
      store = s;
      channel = factory(opts.channel);
      channel?.addEventListener('message', onMessage);
    },
    afterApply(ctx: MutationCtx<T>) {
      if (ctx.source === 'remote') return; // don't echo a peer's change back
      if (ctx.patches.length === 0) return;
      channel?.postMessage({ kind: 'patches', patches: ctx.patches } satisfies PatchMessage);
    },
    destroy() {
      channel?.removeEventListener('message', onMessage);
      channel?.close();
    },
  };
}
