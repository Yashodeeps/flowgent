// EX5: cross-tab sync via BroadcastChannel + stale-accept rejection.
// Patches broadcast when a proposal is committed (acceptBatch → _applyMutation).

import { afterEach, describe, expect, it } from 'vitest';
import { makeBridge, makeItem, MockBroadcastChannel } from './helpers.js';
import type { Bridge, Proposal } from '../src/types.js';

describe('Bridge — cross-tab sync (EX5)', () => {
  const bridges: Bridge[] = [];
  const track = (b: Bridge): Bridge => {
    bridges.push(b);
    return b;
  };
  afterEach(() => {
    while (bridges.length) bridges.pop()!.destroy();
  });

  it('patch in instance A propagates to instance B via BroadcastChannel', async () => {
    const a = track(
      makeBridge({
        broadcast: new MockBroadcastChannel('flowgent:s'),
        aiGenerate: async () => [makeItem('e1', 'design')],
      }),
    );
    const b = track(makeBridge({ broadcast: new MockBroadcastChannel('flowgent:s') }));

    await a.submit('x'); // stage proposal
    await a.acceptBatch(a.getState().pendingProposal!); // commit → broadcast

    expect(a.getState().snapshot.version).toBe(1);
    expect(b.getState().snapshot.entities['e1']).toBeDefined();
    expect(b.getState().snapshot.version).toBe(1);
  });

  it('stale acceptBatch (older snapshot version) is rejected with snapshot-conflict', async () => {
    const a = track(
      makeBridge({
        broadcast: new MockBroadcastChannel('flowgent:s2'),
        aiGenerate: async () => [makeItem('e1', 'design')],
      }),
    );
    const b = track(makeBridge({ broadcast: new MockBroadcastChannel('flowgent:s2') }));

    await a.submit('x');
    await a.acceptBatch(a.getState().pendingProposal!); // A → v1; B receives → v1
    expect(b.getState().snapshot.version).toBe(1);

    const stale: Proposal = {
      id: 'p',
      sourceQuestionId: 'q',
      items: [],
      rawUserInput: '',
      basedOnVersion: 0, // generated against v0 — now stale
    };
    await b.acceptBatch(stale);

    expect(b.getState().lastError).toEqual({ kind: 'snapshot-conflict', patchIndex: 0 });
    expect(b.getState().pendingProposal).toBeNull();
    expect(b.getState().snapshot.version).toBe(1); // unchanged — accept was rejected
  });

  it('falls back gracefully when BroadcastChannel is unavailable', async () => {
    const bridge = track(
      makeBridge({ broadcast: null, aiGenerate: async () => [makeItem('e1', 'design')] }),
    );

    await bridge.submit('x');
    await expect(bridge.acceptBatch(bridge.getState().pendingProposal!)).resolves.toBeUndefined();
    expect(bridge.getState().snapshot.entities['e1']).toBeDefined();
  });
});
