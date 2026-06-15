// Bridge: the opinionated file that enforces every UX contract.
// Day 1: skeleton. Pattern 1 wired. _applyMutation funnel in place (EX3).
// Subscribe plumbing for useBridge() (EX2). BroadcastChannel stub (EX5).
// Debounced localStorage write (EX10). Error state surface (EX6).
// Day 2+ wires Patterns 2-5.

import { emptySnapshot, applyPatches, emitQuestion, nextStep } from './fsm.js';
import { mapErrorToWizardError } from './ai.js';
import {
  markSession,
  shouldResume,
  type PersistenceAdapter,
  localStorageAdapter,
} from './patterns/01-no-auto-resume.js';
import { checkOrphans } from './patterns/04-orphan-detection.js';
import { entityId } from './types.js';
import type {
  Bridge,
  BridgeOptions,
  BridgeState,
  Proposal,
  Snapshot,
  SnapshotPatch,
  WizardConfig,
  WizardError,
} from './types.js';

interface InternalDeps {
  adapter?: PersistenceAdapter; // tests inject in-memory
  broadcast?: BroadcastChannelLike | null; // tests inject; null disables cross-tab
}

export interface BroadcastChannelLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  close(): void;
}

function makeDefaultBroadcast(sessionId: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(`flowgent:${sessionId}`);
}

const DEFAULT_DEBOUNCE_MS = 150;

export function createBridge(
  config: WizardConfig,
  options: BridgeOptions,
  deps: InternalDeps = {},
): Bridge {
  const adapter = deps.adapter ?? localStorageAdapter;
  const broadcast =
    deps.broadcast === null
      ? null
      : (deps.broadcast ?? makeDefaultBroadcast(config.sessionId));
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  let state: BridgeState = {
    currentQuestion: null,
    snapshot: emptySnapshot(),
    pendingProposal: null,
    pendingDestructive: null,
    lastError: null,
    aiStatus: 'idle',
    recentSkip: null,
  };

  const listeners = new Set<() => void>();
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSnapshot: Snapshot | null = null;

  // EX10: debounced localStorage write.
  function scheduleWrite(snapshot: Snapshot): void {
    pendingSnapshot = snapshot;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      if (pendingSnapshot) {
        markSession(config.sessionId, pendingSnapshot, adapter);
        pendingSnapshot = null;
      }
      writeTimer = null;
    }, debounceMs);
  }

  function flushPendingWrite(): void {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    if (pendingSnapshot) {
      markSession(config.sessionId, pendingSnapshot, adapter);
      pendingSnapshot = null;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushPendingWrite);
  }

  function notify(): void {
    for (const l of listeners) l();
  }

  function setState(partial: Partial<BridgeState>): void {
    state = { ...state, ...partial };
    notify();
  }

  // EX6: error normalization. Tests (and the AI layer) may throw a WizardError
  // directly (e.g. ai-malformed-response from a Zod parse failure); otherwise we
  // map an SDK-shaped error via mapErrorToWizardError.
  function toWizardError(raw: unknown): WizardError {
    if (raw && typeof raw === 'object' && 'kind' in raw && typeof (raw as { kind?: unknown }).kind === 'string') {
      return raw as WizardError;
    }
    return mapErrorToWizardError(raw);
  }

  const MAX_RATE_LIMIT_RETRIES = 5;
  const MAX_NETWORK_RETRIES = 1;

  // Retry policy per error kind. rate-limit honors retryAfterMs with exponential
  // backoff; network retries once; everything else surfaces immediately.
  function retryPolicy(err: WizardError, attempt: number): { retry: boolean; delayMs: number } {
    if (err.kind === 'ai-rate-limit') {
      if (attempt >= MAX_RATE_LIMIT_RETRIES) return { retry: false, delayMs: 0 };
      return { retry: true, delayMs: err.retryAfterMs * 2 ** attempt };
    }
    if (err.kind === 'ai-network') {
      if (attempt >= MAX_NETWORK_RETRIES) return { retry: false, delayMs: 0 };
      return { retry: true, delayMs: 200 * 2 ** attempt };
    }
    return { retry: false, delayMs: 0 };
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // EX6: run an AI operation with the error surface + auto-retry.
  // aiStatus transitions: idle → thinking → (retrying)* → idle.
  async function runAI<T>(fn: () => Promise<T>): Promise<T> {
    setState({ aiStatus: 'thinking', lastError: null });
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const result = await fn();
        setState({ aiStatus: 'idle', lastError: null });
        return result;
      } catch (raw) {
        const err = toWizardError(raw);
        const policy = retryPolicy(err, attempt);
        if (!policy.retry) {
          setState({ aiStatus: 'idle', lastError: err });
          throw err;
        }
        setState({ aiStatus: 'retrying' });
        await delay(policy.delayMs);
        attempt += 1;
      }
    }
  }

  // EX3: every public mutation funnels through _applyMutation.
  // Adding a new public mutation method REQUIRES going through here, which
  // ensures Pattern 4 orphan-check fires (Day 3 wires checkOrphans into this).
  function _applyMutation(patches: SnapshotPatch[], _source: string): void {
    const nextSnapshot = applyPatches(state.snapshot, patches);
    // Pattern 4 (EX3): the orphan check runs for EVERY mutation because they all
    // funnel through here. If the active question's entity was just removed, skip
    // the question and surface a RecentSkip toast instead of asking it anyway.
    const orphan = checkOrphans(nextSnapshot, state.currentQuestion);
    if (orphan.isOrphan && state.currentQuestion) {
      setState({
        snapshot: nextSnapshot,
        currentQuestion: null,
        recentSkip: {
          skippedQuestionId: state.currentQuestion.id,
          reason: orphan.reason ?? 'Question no longer applies.',
          deletedEntityId: orphan.deletedEntityId,
        },
      });
    } else {
      setState({ snapshot: nextSnapshot });
    }
    scheduleWrite(nextSnapshot);
    if (broadcast) {
      broadcast.postMessage({ kind: 'patches', patches, version: nextSnapshot.version });
    }
  }

  // Convert an accepted proposal into snapshot patches: one entity per item,
  // plus a parent→child edge when the item declares a parent.
  function proposalToPatches(proposal: Proposal): SnapshotPatch[] {
    const patches: SnapshotPatch[] = [];
    for (const item of proposal.items) {
      const id = entityId(item.id);
      patches.push({
        op: 'add',
        path: `/entities/${item.id}`,
        value: { id, kind: item.willCreate.kind, data: { label: item.text } },
        questionId: proposal.sourceQuestionId,
      });
      if (item.willCreate.parent) {
        patches.push({ op: 'add', path: '/edges/-', value: [item.willCreate.parent, id] });
      }
    }
    return patches;
  }

  // Advance the FSM to the next step's question, or null when the flow is done.
  function advance(): void {
    const currentStepId = state.currentQuestion?.stepId ?? null;
    const next = nextStep(config.stepGrammar, currentStepId);
    const nextQuestion = next ? emitQuestion(config.stepGrammar, next, config, null) : null;
    setState({ currentQuestion: nextQuestion });
  }

  // EX5: cross-tab sync listener.
  function handleBroadcastMessage(e: MessageEvent): void {
    const msg = e.data as { kind: string; patches?: SnapshotPatch[]; version?: number };
    if (msg.kind === 'patches' && msg.patches && typeof msg.version === 'number') {
      // Apply incoming patches if our version is older.
      if (msg.version > state.snapshot.version) {
        const nextSnapshot = applyPatches(state.snapshot, msg.patches);
        setState({ snapshot: nextSnapshot });
      }
    }
  }
  if (broadcast) {
    broadcast.addEventListener('message', handleBroadcastMessage);
  }

  const bridge: Bridge = {
    // Pattern 1 (functional today).
    loadSession() {
      const r = shouldResume(config.sessionId, adapter);
      return r.resumable && r.snapshot ? r.snapshot : null;
    },
    saveSession(snapshot) {
      markSession(config.sessionId, snapshot, adapter);
    },

    // FSM orchestration.
    start() {
      const q = emitQuestion(config.stepGrammar, config.stepGrammar.rootStepId, config, null);
      setState({ currentQuestion: q, pendingProposal: null, recentSkip: null, lastError: null });
    },
    async submit(answer: string) {
      // Pattern 2: the AI proposes a batch the user reviews BEFORE anything is
      // committed. Nothing mutates the snapshot here — submit only stages a
      // pendingProposal. Without a generator, fall back to the no-op funnel.
      if (!options.aiGenerate) {
        _applyMutation([], `submit:${answer}`);
        return;
      }
      try {
        const items = await runAI(() =>
          options.aiGenerate!(answer, state.snapshot, state.currentQuestion),
        );
        setState({
          pendingProposal: {
            id: `proposal-${state.snapshot.version}`,
            sourceQuestionId: state.currentQuestion?.id ?? '',
            items,
            rawUserInput: answer,
            basedOnVersion: state.snapshot.version,
          },
        });
      } catch {
        // runAI already surfaced the error via state.lastError; nothing to stage.
      }
    },
    async acceptBatch(proposal: Proposal) {
      // EX5: reject a stale accept — another tab advanced the snapshot past the
      // version this proposal was generated against.
      if (
        typeof proposal.basedOnVersion === 'number' &&
        proposal.basedOnVersion < state.snapshot.version
      ) {
        setState({
          lastError: { kind: 'snapshot-conflict', patchIndex: 0 },
          pendingProposal: null,
        });
        return;
      }
      // Commit the proposal's items as entities, then advance to the next step.
      _applyMutation(proposalToPatches(proposal), 'acceptBatch');
      advance();
      setState({ pendingProposal: null });
    },
    rejectBatch() {
      setState({ pendingProposal: null });
    },
    goBack() {
      // Day 2+: real history navigation.
    },
    jumpTo(_stepId: string) {
      // Day 2+: validated step jump.
    },

    // Pattern 3: per-item controls on the pending proposal (no LLM round-trip,
    // except regenerateProposal which re-runs the AI for the whole batch).
    editItem(itemId, text) {
      const p = state.pendingProposal;
      if (!p) return;
      setState({
        pendingProposal: {
          ...p,
          items: p.items.map((it) => (it.id === itemId ? { ...it, text } : it)),
        },
      });
    },
    addProposalItem(text) {
      const p = state.pendingProposal;
      if (!p) return;
      const kind =
        (state.currentQuestion &&
          config.stepGrammar.steps[state.currentQuestion.stepId]?.emitsEntityKind) ||
        p.items[0]?.willCreate.kind ||
        'item';
      setState({
        pendingProposal: {
          ...p,
          items: [
            ...p.items,
            { id: crypto.randomUUID(), text, collapsed: false, willCreate: { kind } },
          ],
        },
      });
    },
    async regenerateProposal() {
      const p = state.pendingProposal;
      if (!p || !options.aiGenerate) return;
      try {
        const items = await runAI(() =>
          options.aiGenerate!(p.rawUserInput, state.snapshot, state.currentQuestion),
        );
        setState({
          pendingProposal: { ...p, id: `proposal-${state.snapshot.version}-r`, items },
        });
      } catch {
        // runAI surfaced the error.
      }
    },
    async reaskItem(_itemId) {
      _applyMutation([], 'reaskItem');
    },
    async regenerateItem(_itemId) {
      _applyMutation([], 'regenerateItem');
    },
    async deleteItem(itemId) {
      // If the item is in the pending proposal, drop it from the proposal.
      const p = state.pendingProposal;
      if (p && p.items.some((it) => it.id === itemId)) {
        setState({ pendingProposal: { ...p, items: p.items.filter((it) => it.id !== itemId) } });
        return;
      }
      // Otherwise it's a committed entity: remove it through the funnel so
      // Pattern 4 orphan detection runs.
      if (state.snapshot.entities[itemId]) {
        _applyMutation([{ op: 'remove', path: `/entities/${itemId}` }], 'deleteItem');
        return;
      }
      _applyMutation([], 'deleteItem');
    },

    // Reactivity (EX2).
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    destroy() {
      flushPendingWrite();
      if (broadcast) {
        broadcast.removeEventListener('message', handleBroadcastMessage);
        broadcast.close();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', flushPendingWrite);
      }
      listeners.clear();
    },
  };

  return bridge;
}
