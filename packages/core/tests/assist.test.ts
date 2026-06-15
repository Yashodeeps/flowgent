// AI-assist layer: runWithRetry (retry/backoff/status) + createAIAssist
// (suggest/rewrite/classify), AI strictly optional.

import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { createAIAssist, runWithRetry } from '../src/assist.js';
import type { AIStatus } from '../src/types.js';

function fakeClient(text: string): Anthropic {
  return {
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] }) },
  } as unknown as Anthropic;
}

describe('runWithRetry', () => {
  it('reports thinking → idle and returns the result on success', async () => {
    const seen: AIStatus[] = [];
    const out = await runWithRetry(async () => 42, { onStatus: (s) => seen.push(s) });
    expect(out).toBe(42);
    expect(seen).toEqual(['thinking', 'idle']);
  });

  it('retries a rate-limit with backoff, then succeeds', async () => {
    let calls = 0;
    const seen: AIStatus[] = [];
    const out = await runWithRetry(
      async () => {
        calls += 1;
        if (calls <= 2) throw { status: 429, headers: { 'retry-after': '0.01' } };
        return 'ok';
      },
      { onStatus: (s) => seen.push(s) },
    );
    expect(out).toBe('ok');
    expect(calls).toBe(3);
    expect(seen[0]).toBe('thinking');
    expect(seen).toContain('retrying');
    expect(seen[seen.length - 1]).toBe('idle');
  });

  it('surfaces ai-invalid-key immediately with no retry', async () => {
    const fn = vi.fn(async () => {
      throw { status: 401 };
    });
    await expect(runWithRetry(fn)).rejects.toEqual({ kind: 'ai-invalid-key' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a network error once then surfaces', async () => {
    const fn = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    await expect(runWithRetry(fn)).rejects.toMatchObject({ kind: 'ai-network' });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('createAIAssist', () => {
  it('throws ai-invalid-key when neither client nor apiKey is given (AI optional)', async () => {
    const assist = createAIAssist({});
    await expect(assist.suggest('x', { prompt: 'p', kind: 'team' })).rejects.toEqual({ kind: 'ai-invalid-key' });
  });

  it('suggest() splits the answer into proposal items with the given kind', async () => {
    const assist = createAIAssist({ client: fakeClient('design\nengineering\nmarketing') });
    const items = await assist.suggest('design, engineering, marketing', { prompt: 'p', kind: 'team' });
    expect(items.map((i) => i.text)).toEqual(['design', 'engineering', 'marketing']);
    expect(items.every((i) => i.willCreate.kind === 'team')).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(3); // unique ids
  });

  it('rewrite() returns the polished text', async () => {
    const assist = createAIAssist({ client: fakeClient('A cleaner sentence.') });
    expect(await assist.rewrite('clean this')).toBe('A cleaner sentence.');
  });

  it('classify() returns a matching category', async () => {
    const assist = createAIAssist({ client: fakeClient('teams') });
    expect(await assist.classify('design and eng', ['teams', 'channels'])).toBe('teams');
  });
});
