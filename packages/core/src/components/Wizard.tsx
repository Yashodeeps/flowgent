// EX4: top-level <Wizard config bridge /> component.
// Magnet user writes ONE line to mount the engine.

import type { Bridge, UIComponentMap, WizardConfig } from '../types.js';
import { ComponentsContext } from './components-context.js';
import { DefaultQuestionCard } from './QuestionCard.js';
import { DefaultPlanStrip } from './PlanStrip.js';
import { DefaultConfirmCard } from './ConfirmCard.js';
import { DefaultStepNav } from './StepNav.js';
import { useBridge } from '../use-bridge.js';

const defaultComponents: UIComponentMap = {
  QuestionCard: DefaultQuestionCard,
  PlanStrip: DefaultPlanStrip,
  ConfirmCard: DefaultConfirmCard,
  StepNav: DefaultStepNav,
};

export function Wizard({ config, bridge }: { config: WizardConfig; bridge: Bridge }) {
  const state = useBridge(bridge);
  const components: UIComponentMap = { ...defaultComponents, ...config.uiOverrides };
  const { QuestionCard, PlanStrip, ConfirmCard, StepNav } = components;

  return (
    <ComponentsContext.Provider value={components}>
      <div className="flowgent-wizard" data-config={config.name}>
        <StepNav snapshot={state.snapshot} onJump={(id) => bridge.jumpTo(id)} />
        <PlanStrip snapshot={state.snapshot} recentSkip={state.recentSkip} />
        {state.pendingProposal ? (
          <ConfirmCard
            proposal={state.pendingProposal}
            onAccept={() => void bridge.acceptBatch(state.pendingProposal!)}
            onReject={() => bridge.rejectBatch()}
            onEditItem={(itemId, text) => bridge.editItem(itemId, text)}
          />
        ) : state.currentQuestion ? (
          <QuestionCard
            question={state.currentQuestion}
            onSubmit={(answer) => void bridge.submit(answer)}
          />
        ) : (
          <p className="flowgent-wizard__idle">No active question.</p>
        )}
        {state.lastError ? (
          <div className="flowgent-wizard__error" role="alert">
            Error: {state.lastError.kind}
          </div>
        ) : null}
      </div>
    </ComponentsContext.Provider>
  );
}
