# @flowgent/core

## 0.2.1

### Patch Changes

- Fix a crash when importing the package barrel (`@flowgent/core`) or the React layer from a native ESM consumer (e.g. `node --input-type=module`, or any non-bundler runtime). `fsm` imported `applyPatch` as a named export from `fast-json-patch`, which is CommonJS and exposes no ESM named exports, so Node's loader threw `SyntaxError: Named export 'applyPatch' not found`. Switched to a default import + destructure. Bundlers (Next.js, Vite) papered over this, so it only affected raw-ESM consumers. The `/store` and `/ai` subpaths were never affected.

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
