// Shared test helpers. Not a *.test file, so vitest's `include` glob skips it.

import { createBridge, type BroadcastChannelLike } from '../src/bridge.js';
import type { PersistenceAdapter } from '../src/patterns/01-no-auto-resume.js';
import type {
  Bridge,
  EntityId,
  ProposalItem,
  Question,
  Snapshot,
  SnapshotPatch,
  WizardConfig,
} from '../src/types.js';
import { stepId } from '../src/types.js';

export function inMemoryAdapter(): PersistenceAdapter {
  const store = new Map<string, string>();
  return {
    read: (k) => store.get(k) ?? null,
    write: (k, v) => void store.set(k, v),
    remove: (k) => void store.delete(k),
  };
}

export function makeConfig(overrides: Partial<WizardConfig> = {}): WizardConfig {
  return {
    name: 'test-wizard',
    sessionId: 'test-session',
    stepGrammar: {
      rootStepId: stepId('start'),
      steps: {
        start: { nextStepIds: [stepId('q1')], questionTemplate: 'Begin?' },
        q1: { nextStepIds: [], questionTemplate: 'Q1?' },
      },
      entitySchema: {} as never,
    },
    prompts: {},
    ...overrides,
  };
}

export interface MakeBridgeOpts {
  adapter?: PersistenceAdapter;
  broadcast?: BroadcastChannelLike | null;
  aiGenerate?: (
    answer: string,
    snapshot: Snapshot,
    question: Question | null,
  ) => Promise<ProposalItem[]>;
  debounceMs?: number;
  config?: Partial<WizardConfig>;
}

export function makeBridge(opts: MakeBridgeOpts = {}): Bridge {
  return createBridge(
    makeConfig(opts.config),
    { apiKey: 'test-key', debounceMs: opts.debounceMs, aiGenerate: opts.aiGenerate },
    {
      // Default to isolated, deterministic deps so unrelated tests don't share
      // localStorage keys or a real BroadcastChannel. Opt back in explicitly.
      adapter: opts.adapter ?? inMemoryAdapter(),
      broadcast: opts.broadcast ?? null,
    },
  );
}

// A single add patch, handy for driving real version bumps in tests.
export function addEntityPatch(id: string, kind = 'workspace'): SnapshotPatch {
  return { op: 'add', path: `/entities/${id}`, value: { id, kind, data: {} } };
}

// A ProposalItem builder for tests/demos that exercise the Pattern 2 accept flow.
export function makeItem(
  id: string,
  text: string,
  kind = 'team',
  parent?: EntityId,
): ProposalItem {
  return { id, text, collapsed: false, willCreate: { kind, ...(parent ? { parent } : {}) } };
}

// In-process BroadcastChannel that fans messages to sibling instances sharing a
// name — but never echoes to the sender, matching the real BroadcastChannel.
export class MockBroadcastChannel implements BroadcastChannelLike {
  private static buses = new Map<string, Set<MockBroadcastChannel>>();
  private listeners = new Set<(e: MessageEvent) => void>();

  constructor(public readonly name: string) {
    const bus = MockBroadcastChannel.buses.get(name) ?? new Set<MockBroadcastChannel>();
    bus.add(this);
    MockBroadcastChannel.buses.set(name, bus);
  }

  postMessage(msg: unknown): void {
    const bus = MockBroadcastChannel.buses.get(this.name);
    if (!bus) return;
    for (const peer of bus) {
      if (peer === this) continue;
      for (const l of peer.listeners) l({ data: msg } as MessageEvent);
    }
  }

  addEventListener(_type: 'message', listener: (e: MessageEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (e: MessageEvent) => void): void {
    this.listeners.delete(listener);
  }

  close(): void {
    MockBroadcastChannel.buses.get(this.name)?.delete(this);
  }
}
