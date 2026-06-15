// EX6: BridgeState.lastError + aiStatus + auto-retry. An injected aiGenerate
// drives the retry/error surface without a network — it throws SDK-shaped errors
// (status codes, mapped by mapErrorToWizardError) or a WizardError directly.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBridge, makeItem } from './helpers.js';
import type { AIStatus, Bridge } from '../src/types.js';

describe('Bridge — error surface + auto-retry (EX6)', () => {
  const bridges: Bridge[] = [];
  const track = (b: Bridge): Bridge => {
    bridges.push(b);
    return b;
  };
  afterEach(() => {
    while (bridges.length) bridges.pop()!.destroy();
  });

  it('rate-limit auto-retries with exponential backoff via retryAfterMs', async () => {
    let calls = 0;
    const aiGenerate = vi.fn(async () => {
      calls += 1;
      if (calls <= 2) throw { status: 429, headers: { 'retry-after': '0.01' } };
      return [makeItem('e1', 'design')];
    });
    const bridge = track(makeBridge({ aiGenerate }));

    await bridge.submit('x');

    expect(aiGenerate).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(bridge.getState().pendingProposal?.items[0]?.id).toBe('e1');
    expect(bridge.getState().lastError).toBeNull();
    expect(bridge.getState().aiStatus).toBe('idle');
  });

  it('aiStatus transitions: idle → thinking → retrying → idle', async () => {
    let calls = 0;
    const aiGenerate = async () => {
      calls += 1;
      if (calls === 1) throw { status: 429, headers: { 'retry-after': '0.01' } };
      return [];
    };
    const bridge = track(makeBridge({ aiGenerate }));

    const seen: AIStatus[] = [bridge.getState().aiStatus];
    bridge.subscribe(() => {
      const s = bridge.getState().aiStatus;
      if (seen[seen.length - 1] !== s) seen.push(s);
    });

    await bridge.submit('x');

    expect(seen).toEqual(['idle', 'thinking', 'retrying', 'idle']);
  });

  it('ai-invalid-key surfaces immediately, no retry', async () => {
    const aiGenerate = vi.fn(async () => {
      throw { status: 401 };
    });
    const bridge = track(makeBridge({ aiGenerate }));

    await bridge.submit('x');

    expect(aiGenerate).toHaveBeenCalledTimes(1);
    expect(bridge.getState().lastError).toEqual({ kind: 'ai-invalid-key' });
    expect(bridge.getState().pendingProposal).toBeNull();
    expect(bridge.getState().aiStatus).toBe('idle');
  });

  it('ai-malformed-response (Zod parse failure) surfaces with raw text', async () => {
    const aiGenerate = async () => {
      throw { kind: 'ai-malformed-response', raw: 'garbled output' };
    };
    const bridge = track(makeBridge({ aiGenerate }));

    await bridge.submit('x');

    expect(bridge.getState().lastError).toEqual({
      kind: 'ai-malformed-response',
      raw: 'garbled output',
    });
    expect(bridge.getState().aiStatus).toBe('idle');
  });

  it('network error retries once, then surfaces', async () => {
    const aiGenerate = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    const bridge = track(makeBridge({ aiGenerate }));

    await bridge.submit('x');

    expect(aiGenerate).toHaveBeenCalledTimes(2); // initial + 1 retry
    expect(bridge.getState().lastError?.kind).toBe('ai-network');
    expect(bridge.getState().aiStatus).toBe('idle');
  });
});
