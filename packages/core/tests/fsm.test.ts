import { describe, it, expect } from 'vitest';
import { emptySnapshot, applyPatches, nextStep } from '../src/fsm.js';
import { stepId } from '../src/types.js';
import type { StepGrammar, SnapshotPatch } from '../src/types.js';

describe('fsm.emptySnapshot', () => {
  it('returns version 0 with no entities', () => {
    const s = emptySnapshot();
    expect(s.version).toBe(0);
    expect(Object.keys(s.entities)).toHaveLength(0);
    expect(s.edges).toEqual([]);
    expect(s.history).toEqual([]);
  });
});

describe('fsm.applyPatches', () => {
  it('returns the same snapshot when patches is empty', () => {
    const s = emptySnapshot();
    expect(applyPatches(s, [])).toBe(s);
  });

  it('applies an add patch and bumps version', () => {
    const s = emptySnapshot();
    const patches: SnapshotPatch[] = [
      { op: 'add', path: '/entities/e1', value: { id: 'e1', kind: 'workspace', data: {} } },
    ];
    const next = applyPatches(s, patches);
    expect(next.version).toBe(1);
    expect(next.entities['e1']).toEqual({ id: 'e1', kind: 'workspace', data: {} });
    expect(next.history).toHaveLength(1);
  });

  it('does not mutate the input snapshot', () => {
    const s = emptySnapshot();
    const patches: SnapshotPatch[] = [
      { op: 'add', path: '/entities/e1', value: { id: 'e1', kind: 'workspace', data: {} } },
    ];
    applyPatches(s, patches);
    expect(s.version).toBe(0);
    expect(Object.keys(s.entities)).toHaveLength(0);
  });
});

describe('fsm.nextStep', () => {
  const grammar: StepGrammar = {
    rootStepId: stepId('start'),
    steps: {
      start: { nextStepIds: [stepId('q1')], questionTemplate: 'Begin?' },
      q1: { nextStepIds: [stepId('q2')], questionTemplate: 'Q1?' },
      q2: { nextStepIds: [], questionTemplate: 'Q2?' },
    },
    // entitySchema isn't exercised here; cast to satisfy the type
    entitySchema: {} as never,
  };

  it('returns rootStepId when current is null', () => {
    expect(nextStep(grammar, null)).toBe(grammar.rootStepId);
  });

  it('returns first nextStepId', () => {
    expect(nextStep(grammar, stepId('start'))).toBe(stepId('q1'));
    expect(nextStep(grammar, stepId('q1'))).toBe(stepId('q2'));
  });

  it('returns null at a terminal step', () => {
    expect(nextStep(grammar, stepId('q2'))).toBeNull();
  });

  it('returns null for unknown step', () => {
    expect(nextStep(grammar, stepId('unknown'))).toBeNull();
  });
});
