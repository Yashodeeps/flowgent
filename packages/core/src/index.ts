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

// Default UI components — exported for selective re-use by demos shadowing
// only some components via uiOverrides.
export { DefaultQuestionCard } from './components/QuestionCard.js';
export { DefaultPlanStrip } from './components/PlanStrip.js';
export { DefaultConfirmCard } from './components/ConfirmCard.js';
export { DefaultStepNav } from './components/StepNav.js';

// FSM primitives — exported for tests and advanced composition.
export { emptySnapshot, applyPatches, nextStep, emitQuestion } from './fsm.js';
