// flowgent/core public types.
// See design doc EX8 for the generic parameterization rationale.

import type { ComponentType } from 'react';
import type { z } from 'zod';

// --- ID brand types ---

export type StepId = string & { readonly __brand: 'StepId' };
export type EntityId = string & { readonly __brand: 'EntityId' };

export const stepId = (s: string): StepId => s as StepId;
export const entityId = (s: string): EntityId => s as EntityId;

// --- Entity / Snapshot ---

export interface Entity<TData = unknown> {
  id: EntityId;
  kind: string;
  data: TData;
}

// SnapshotPatch uses JSON Patch (RFC 6902) shape per EX7.
export interface SnapshotPatch {
  op: 'add' | 'remove' | 'replace';
  path: string; // JSON Pointer
  value?: unknown;
  questionId?: string;
}

export interface Snapshot {
  version: number; // bumped on every patch; used by stale-acceptBatch rejection (EX5).
  entities: Record<string, Entity>;
  edges: Array<[EntityId, EntityId]>; // [parent, child]
  history: SnapshotPatch[];
}

// --- Proposal (Pattern 2/3) ---

export interface ProposalItem {
  id: string;
  text: string;
  collapsed: boolean;
  willCreate: { kind: string; parent?: EntityId };
}

export interface Proposal {
  id: string;
  sourceQuestionId: string;
  items: ProposalItem[];
  rawUserInput: string;
  // Snapshot.version this proposal was generated against (EX5). If another tab
  // advances the snapshot past this, acceptBatch() rejects with snapshot-conflict.
  basedOnVersion?: number;
}

// --- Question / OrphanCheck / DestructiveAction ---

export interface Question {
  id: string;
  stepId: StepId;
  prompt: string;
  dependsOn: EntityId | null;
}

export interface OrphanCheck {
  isOrphan: boolean;
  reason?: string;
  deletedEntityId?: EntityId;
}

export interface DestructiveAction {
  id: string;
  kind: 'delete-entity' | 'reset-wizard' | 'discard-proposal';
  targetEntityId?: EntityId;
  cascadeDescription: string;
}

// --- StepGrammar / WizardConfig (EX8 generic) ---

export interface StepGrammarStep {
  nextStepIds: StepId[];
  emitsEntityKind?: string;
  questionTemplate: string;
}

export interface StepGrammar<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  rootStepId: StepId;
  steps: Record<string, StepGrammarStep>;
  entitySchema: TSchema;
}

export interface UIComponentMap {
  QuestionCard: ComponentType<{ question: Question; onSubmit: (answer: string) => void }>;
  PlanStrip: ComponentType<{ snapshot: Snapshot; recentSkip?: RecentSkip | null }>;
  ConfirmCard: ComponentType<{
    proposal: Proposal;
    onAccept: () => void;
    onReject: () => void;
    onEditItem: (itemId: string, text: string) => void;
  }>;
  StepNav: ComponentType<{ snapshot: Snapshot; onJump: (stepId: string) => void }>;
}

export interface WizardConfig<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  sessionId: string; // used for localStorage key + BroadcastChannel name
  stepGrammar: StepGrammar<TSchema>;
  prompts: Record<string, string>;
  uiOverrides?: Partial<UIComponentMap>;
}

// --- Error model (EX6) ---

export type WizardError =
  | { kind: 'ai-rate-limit'; retryAfterMs: number }
  | { kind: 'ai-invalid-key' }
  | { kind: 'ai-malformed-response'; raw: string }
  | { kind: 'ai-network'; cause: string }
  | { kind: 'snapshot-conflict'; patchIndex: number };

// --- Recent skip (Pattern 4 surface) ---

export interface RecentSkip {
  skippedQuestionId: string;
  reason: string;
  deletedEntityId?: EntityId;
}

// --- Bridge state and interface ---

export type AIStatus = 'idle' | 'thinking' | 'retrying';

export interface BridgeState {
  currentQuestion: Question | null;
  snapshot: Snapshot;
  pendingProposal: Proposal | null;
  pendingDestructive: DestructiveAction | null;
  lastError: WizardError | null; // EX6
  aiStatus: AIStatus; // EX6
  recentSkip: RecentSkip | null; // EX5/Pattern 4
}

export interface BridgeOptions {
  apiKey: string;
  providerBaseURL?: string; // EX1: opt-in proxy
  debounceMs?: number; // EX10: localStorage write debounce, default 150
  // Pattern 2 generator: turn a user's free-text answer into the items they'll
  // confirm. Omit for the no-op fallback. Demos wire ai.split() here; tests
  // inject a fake to exercise the retry/error surface without a network.
  aiGenerate?: (
    answer: string,
    snapshot: Snapshot,
    question: Question | null,
  ) => Promise<ProposalItem[]>;
}

export interface Bridge {
  // Lifecycle (Pattern 1)
  loadSession(): Snapshot | null;
  saveSession(snapshot: Snapshot): void;

  // FSM orchestration
  start(): void; // emit the root question and begin the flow
  submit(answer: string): Promise<void>;
  acceptBatch(proposal: Proposal): Promise<void>;
  rejectBatch(): void;
  goBack(): void;
  jumpTo(stepId: string): void;

  // Pattern 3 (per-item controls)
  editItem(itemId: string, newText: string): void;
  addProposalItem(text: string): void; // add a manual item to the pending proposal
  regenerateProposal(): Promise<void>; // re-run the AI for the whole pending batch
  reaskItem(itemId: string): Promise<void>;
  regenerateItem(itemId: string): Promise<void>;
  deleteItem(itemId: string): Promise<void>;

  // Reactivity (EX2)
  getState(): BridgeState;
  subscribe(listener: () => void): () => void;

  // Cleanup
  destroy(): void;
}
