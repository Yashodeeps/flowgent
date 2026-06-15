// @flowgent/core public API barrel.

export type {
  // IDs
  StepId,
  EntityId,
  // State
  Entity,
  Snapshot,
  SnapshotPatch,
  Proposal,
  ProposalItem,
  Question,
  OrphanCheck,
  DestructiveAction,
  RecentSkip,
  // Config
  StepGrammar,
  StepGrammarStep,
  WizardConfig,
  UIComponentMap,
  // Bridge
  Bridge,
  BridgeOptions,
  BridgeState,
  AIStatus,
  WizardError,
} from './types.js';

export { stepId, entityId } from './types.js';

export { createBridge } from './bridge.js';
export { useBridge } from './use-bridge.js';
export { Wizard } from './components/Wizard.js';
export { useComponents } from './components/components-context.js';

// Pattern modules — exported for users who want to compose patterns into
// custom bridges (advanced; most users use createBridge).
export * as Pattern1NoAutoResume from './patterns/01-no-auto-resume.js';
export * as Pattern4OrphanDetection from './patterns/04-orphan-detection.js';
export { checkOrphans } from './patterns/04-orphan-detection.js';

// AI primitives.
export { createAIClient, mapErrorToWizardError, split, polish, classify } from './ai.js';

// AI-assist (Layer 2) — optional suggest/rewrite/classify + retry engine.
export { createAIAssist, runWithRetry, toWizardError, retryPolicy } from './assist.js';
export type { AIAssist, AIAssistOptions, SuggestOptions, RunOptions } from './assist.js';

// Store (Layer 1) — headless state core.
export { createStore } from './store/index.js';
export type { Store, StoreOptions, Middleware, MutationCtx, MutationSource, Patch } from './store/index.js';
export { persist, loadPersisted, clearPersisted, localStorageAdapter } from './store/middleware/persist.js';
export type { PersistOptions, PersistAdapter } from './store/middleware/persist.js';
export { crossTab } from './store/middleware/cross-tab.js';
export { destructiveGate } from './store/middleware/destructive.js';

// React store hooks (also available React-free? no — these need React).
export { useStore, useStoreSelector } from './react/index.js';

// Default UI components — exported for selective re-use by demos shadowing
// only some components via uiOverrides.
export { DefaultQuestionCard } from './components/QuestionCard.js';
export { DefaultPlanStrip } from './components/PlanStrip.js';
export { DefaultConfirmCard } from './components/ConfirmCard.js';
export { DefaultStepNav } from './components/StepNav.js';

// FSM primitives — exported for tests and advanced composition.
export { emptySnapshot, applyPatches, nextStep, emitQuestion } from './fsm.js';
