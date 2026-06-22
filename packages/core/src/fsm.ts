// Deterministic tree-walking sequencer. No AI in the routing path.
// Day 1: minimal implementation that compiles + passes basic tests.
// Day 3+ extends with full branching + cycle detection.

// fast-json-patch is CommonJS — Node's ESM loader can't pluck named exports off
// it, so importing `{ applyPatch }` crashes a real ESM consumer (bundlers paper
// over this, which is why the demos never hit it). Default-import the module and
// destructure the value; `Operation` is a type, erased at compile time.
import fastJsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
const { applyPatch } = fastJsonPatch;
import type { Question, Snapshot, SnapshotPatch, StepGrammar, StepId } from './types.js';

export function emptySnapshot(): Snapshot {
  return { version: 0, entities: {}, edges: [], history: [] };
}

// applyPatches: applies SnapshotPatch[] via fast-json-patch (EX7).
// Returns a new Snapshot (immutable update). Bumps version per patch.
export function applyPatches(snapshot: Snapshot, patches: SnapshotPatch[]): Snapshot {
  if (patches.length === 0) return snapshot;
  const ops: Operation[] = patches.map((p) => {
    if (p.op === 'remove') {
      return { op: 'remove', path: p.path };
    }
    return { op: p.op, path: p.path, value: p.value } as Operation;
  });
  const result = applyPatch(snapshot, ops, /* validate */ true, /* mutate */ false).newDocument;
  return {
    ...result,
    version: snapshot.version + patches.length,
    history: [...snapshot.history, ...patches],
  };
}

// nextStep: given current step + grammar, returns the next step id, or null at terminal.
// Day 1: picks the first nextStepIds. Day 3+ adds branching predicates.
export function nextStep(
  grammar: StepGrammar,
  currentStepId: StepId | null,
): StepId | null {
  if (currentStepId === null) return grammar.rootStepId;
  const step = grammar.steps[currentStepId];
  if (!step) return null;
  if (step.nextStepIds.length === 0) return null;
  // First-match for Day 1; predicate-based selection added Day 3+.
  return step.nextStepIds[0] ?? null;
}

// emitQuestion: build a Question for the current FSM state.
export function emitQuestion(
  grammar: StepGrammar,
  stepIdValue: StepId,
  config: { prompts: Record<string, string> },
  dependsOn: import('./types.js').EntityId | null = null,
): Question | null {
  const step = grammar.steps[stepIdValue];
  if (!step) return null;
  const prompt = config.prompts[stepIdValue] ?? step.questionTemplate;
  return {
    id: `${stepIdValue}:${crypto.randomUUID()}`,
    stepId: stepIdValue,
    prompt,
    dependsOn,
  };
}
