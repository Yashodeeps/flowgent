# @flowgent/core

## 0.2.0

### Minor Changes

- `@flowgent/core/store` is now self-contained: `persist`, `crossTab`, and `destructiveGate` (plus `loadPersisted`/`clearPersisted`/`localStorageAdapter`) are re-exported from the `/store` subpath. Headless consumers no longer need to reach into the barrel (`@flowgent/core`) just to get the built-in middleware — everything for a non-React, non-AI store lives under `@flowgent/core/store`.

## 0.1.0

### Minor Changes

- Layered architecture. `@flowgent/core` is now three independently-usable layers:

  - **Layer 1 — Store** (`@flowgent/core/store`): headless `createStore<T>()` with `mutate(recipe)` (Immer), undo/redo (capped + coalescing), cross-tab sync, debounced persistence, and a `beforeApply`-veto middleware pipeline. No React, no AI.
  - **`@flowgent/core/graph`**: entity-graph preset + orphan-detection middleware.
  - **Layer 2 — AI-assist** (`createAIAssist`): optional `suggest`/`rewrite`/`classify` wrapping Claude with retry/backoff; AI is strictly optional.
  - **Layer 3 — React wizard**: the existing `createBridge`/`<Wizard>` API, unchanged.

  New subpath exports: `.`, `/store`, `/react`, `/ai`, `/graph` (the headless store is React-free). `react` is now an **optional** peer dependency. Adds `immer`; `useStore`/`useStoreSelector` hooks added.
