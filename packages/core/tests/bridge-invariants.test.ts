// EX3 + Pattern 4: every public mutation funnels through _applyMutation, which
// runs checkOrphans. We mock the Pattern 4 module to assert the funnel fires it,
// then test checkOrphans' own logic directly.

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/patterns/04-orphan-detection.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/patterns/04-orphan-detection.js')>();
  return { ...actual, checkOrphans: vi.fn(actual.checkOrphans) };
});

import { checkOrphans } from '../src/patterns/04-orphan-detection.js';
import { applyPatches, emptySnapshot } from '../src/fsm.js';
import { entityId, stepId } from '../src/types.js';
import type { Proposal, Question } from '../src/types.js';
import { addEntityPatch, makeBridge } from './helpers.js';

const checkOrphansMock = vi.mocked(checkOrphans);
const emptyProposal: Proposal = { id: 'p', sourceQuestionId: 'q', items: [], rawUserInput: '' };

describe('Bridge — _applyMutation invariant (EX3)', () => {
  it('every public mutation method routes through _applyMutation', async () => {
    const bridge = makeBridge();
    const mutations: Array<() => Promise<unknown> | void> = [
      () => bridge.submit('a'),
      () => bridge.acceptBatch(emptyProposal),
      () => bridge.deleteItem('i'),
      () => bridge.reaskItem('i'),
      () => bridge.regenerateItem('i'),
    ];
    for (const run of mutations) {
      checkOrphansMock.mockClear();
      await run();
      expect(checkOrphansMock).toHaveBeenCalledTimes(1);
    }
    bridge.destroy();
  });

  it('checkOrphans fires after submit', async () => {
    const bridge = makeBridge();
    checkOrphansMock.mockClear();
    await bridge.submit('a');
    expect(checkOrphansMock).toHaveBeenCalled();
    bridge.destroy();
  });

  it('checkOrphans fires after acceptBatch', async () => {
    const bridge = makeBridge();
    checkOrphansMock.mockClear();
    await bridge.acceptBatch(emptyProposal);
    expect(checkOrphansMock).toHaveBeenCalled();
    bridge.destroy();
  });

  it('checkOrphans fires after deleteItem', async () => {
    const bridge = makeBridge();
    checkOrphansMock.mockClear();
    await bridge.deleteItem('i');
    expect(checkOrphansMock).toHaveBeenCalled();
    bridge.destroy();
  });

  it('checkOrphans fires after reaskItem', async () => {
    const bridge = makeBridge();
    checkOrphansMock.mockClear();
    await bridge.reaskItem('i');
    expect(checkOrphansMock).toHaveBeenCalled();
    bridge.destroy();
  });
});

describe('checkOrphans (Pattern 4) logic', () => {
  const question: Question = {
    id: 'q1',
    stepId: stepId('s'),
    prompt: 'Tell us about the workspace',
    dependsOn: entityId('e1'),
  };

  it('no orphan while the depended-on entity exists', () => {
    const snap = applyPatches(emptySnapshot(), [addEntityPatch('e1')]);
    expect(checkOrphans(snap, question).isOrphan).toBe(false);
  });

  it('orphan when the depended-on entity was removed', () => {
    const snap = applyPatches(emptySnapshot(), [addEntityPatch('e1')]);
    const removed = applyPatches(snap, [{ op: 'remove', path: '/entities/e1' }]);
    const result = checkOrphans(removed, question);
    expect(result.isOrphan).toBe(true);
    expect(result.deletedEntityId).toBe('e1');
  });

  it('no orphan for a question that depends on nothing', () => {
    expect(checkOrphans(emptySnapshot(), { ...question, dependsOn: null }).isOrphan).toBe(false);
  });

  it('no orphan when there is no active question', () => {
    expect(checkOrphans(emptySnapshot(), null).isOrphan).toBe(false);
  });
});
