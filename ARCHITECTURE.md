# Architecture

`@flowgent/core` is three layers. Each is usable on its own; higher layers compose
lower ones. The point: the same engine powers a linear AI wizard **and** a
direct-manipulation surface (canvas, doc, design tool).

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 3  WIZARD (optional)    @flowgent/core/react                │
│   createBridge · <Wizard> · stepGrammar · currentQuestion         │
│   = Store<Snapshot> + AI-assist + wizard pattern logic            │
├──────────────────────────────────────────────────────────────────┤
│ Layer 2  AI-ASSIST (optional)  @flowgent/core (createAIAssist)    │
│   suggest() · rewrite() · classify()  — wraps the /ai primitives  │
│   with retry/backoff; produces confirmable proposals (P2/P3)      │
├──────────────────────────────────────────────────────────────────┤
│ Layer 1  STORE (core)  @flowgent/core/store   (NO react, NO ai)   │
│   createStore<T>() · mutate(recipe) · undo/redo · applyExternal   │
│   getState/subscribe · middleware pipeline                        │
│   built-in middleware: persist · crossTab · destructiveGate       │
│                                                                   │
│   @flowgent/core/graph: entity-graph preset + orphan middleware   │
└──────────────────────────────────────────────────────────────────┘
   canvas / doc / design  ─────────► createStore<T> directly
```

## The mutation funnel (Layer 1)

Every state change goes through one funnel. There is no second path.

```
store.mutate(recipe, { coalesceKey? })
  ├─ produceWithPatches(state, recipe)  →  { next, patches, inversePatches }   (Immer)
  ├─ middleware.beforeApply(ctx)        →  a false return VETOES (held)
  ├─ commit next; version++
  ├─ history.record({ patches, inversePatches })   // coalesce window + maxUndo cap
  ├─ middleware.afterApply(ctx)         //  persist (debounced), crossTab.broadcast
  └─ notify subscribers

store.undo()  →  apply inversePatches (source 'undo', not re-recorded)
store.redo()  →  apply patches       (source 'redo')
store.applyExternalPatches(patches)   →  source 'remote'; NOT on the undo stack
   (cross-tab receive + AI proposal commit both route here)
```

- **Undo** uses Immer's inverse patches (correct by construction). The history holds
  patches only, never full state, so memory is bounded; a cap + a coalescing window
  (a drag = one undo step) keep it small.
- **Middleware** is a `{ name, attach?, beforeApply?, afterApply?, destroy? }` object.
  `beforeApply` can veto (destructive-confirm holds a delete until confirmed).
  `attach(store)` lets a middleware push patches back in (cross-tab receive).
- **Cross-tab** broadcasts local/undo/redo patches over a `BroadcastChannel`; peers
  apply them via `applyExternalPatches`. This is the seam where a future multiplayer
  transport (Yjs/websocket) would plug in — same patch protocol, different channel.

## Layer 2 — AI-assist

`createAIAssist({ apiKey | client })` returns `suggest` / `rewrite` / `classify`,
each wrapping a Claude call (`@flowgent/core/ai`) with `runWithRetry`
(idle → thinking → retrying → idle, exponential backoff, normalized `WizardError`).
AI is strictly optional: with no key, calls surface `ai-invalid-key` instead of
crashing, and the store works with none of it.

## Layer 3 — the wizard

`createBridge` composes a `Store<Snapshot>` (entity-graph state) with AI-assist and
the five UX contracts:

1. Never auto-resume drafts (persist + explicit resume).
2. Editable AI confirmations (review a proposal before commit).
3. Per-item edit / add / remove / regenerate on a pending proposal.
4. Orphan-question detection (skip a question whose entity was deleted).
5. Destructive-action confirmation.

`<Wizard>` renders default UI you can override per-component via `uiOverrides`, or
you can drive the bridge directly with `useBridge` for a fully custom surface (the
reference demos in `docs-site/` do the latter).

## Package layout

```
packages/core/src/
  store/        Layer 1: createStore, undo, middleware/{persist,cross-tab,destructive}
  graph/        entity-graph preset + orphan middleware
  ai.ts         AI primitives (split/polish/classify)
  assist.ts     Layer 2: createAIAssist + runWithRetry
  react/        useStore/useStoreSelector + re-exported wizard React surface
  bridge.ts     Layer 3: createBridge (the wizard)
  components/    default <Wizard> UI
  index.ts      barrel ('.')
```

Subpath exports keep the headless store React-free: `.`, `/store`, `/react`, `/ai`,
`/graph`.
