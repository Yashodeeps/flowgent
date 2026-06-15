# @flowgent/core

The engine: deterministic FSM + AI-aware bridge + 5 UX pattern modules + default React UI.

```bash
npm install @flowgent/core
```

## What's in here

- `src/types.ts` — public types: `Snapshot`, `Proposal`, `Question`, `Bridge`, `BridgeState`, `WizardConfig`, `WizardError`, etc.
- `src/fsm.ts` — pure tree-walking sequencer. No AI in routing.
- `src/ai.ts` — AI primitives (`split`, `polish`, `classify`) with auto-retry and error surfacing.
- `src/bridge.ts` — the opinionated file. Composes the 5 patterns; enforces every UX contract.
- `src/patterns/01-no-auto-resume.ts` … `05-destructive-confirm.ts` — canonical pattern modules.
- `src/use-bridge.ts` — `useBridge(bridge): BridgeState` React hook (via `useSyncExternalStore`).
- `src/components/Wizard.tsx` — top-level `<Wizard config bridge>` component.

## Minimum example

```tsx
import { createBridge, Wizard } from '@flowgent/core';
import { onboardingConfig } from './onboarding.config';

const bridge = createBridge(onboardingConfig, { apiKey: localStorage.getItem('anthropic-key')! });

export default function Page() {
  return <Wizard config={onboardingConfig} bridge={bridge} />;
}
```

## Status

V0.0.1 — scaffold. APIs are NOT stable until V0.1.0.
