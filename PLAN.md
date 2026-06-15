# flowgent v0.1 — Store-core refactor + publishability

Execution plan from `/plan-eng-review` (2026-06-15). Goal: make `@flowgent/core`
flexible beyond linear AI wizards (power canvas/doc/design editors on the same
engine) and publish it to npm. Source of truth for problem/constraints: the
office-hours design doc in `~/.gstack/projects/flowgent/`.

## Locked decisions (review gates)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Realtime scope | **Single-user reactive + cross-tab.** Multiplayer/CRDT deferred to a future sync adapter. |
| D2 | Build scope | **Full** — Store + undo + AI-assist (suggest/rewrite/classify) + pluggable middleware + wizard nav + canvas demo + publish. |
| 1 | Store state shape | **Generic `createStore<T>()`** + ship entity-graph as opt-in `/graph` helper. Orphan-detection becomes graph middleware. |
| 2 | Patch engine | **Adopt Immer.** `mutate(draft => …)` recipes; `produceWithPatches` gives forward+inverse patches; drop fast-json-patch. Breaking `SnapshotPatch` type change (pre-1.0). |
| 3 | Back-compat | **Strangler.** Keep `createBridge`/`<Wizard>` API + behavior; reimplement on Store. 41 tests stay green as the regression net. |
| 4 | Exports | **Layered subpaths, one package:** `.`, `/store`, `/react`, `/ai`, `/graph`. Headless store is React-free. |
| 5 | Middleware API | **Lifecycle objects** `{ beforeApply(ctx)->boolean\|void, afterApply(ctx) }`; `beforeApply` returning false vetoes (destructive-confirm). |
| 6 | Undo testing | **Examples + fast-check property tests** (mutate→undo round-trips to prior state; redo symmetry). |
| 7 | Undo memory | **Capped + coalesce** — `maxUndo` default 100 (drop oldest), `coalesceMs` 300 (drag = one undo step). Remote/AI patches bypass the undo stack. |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 3  WIZARD (optional)  @flowgent/core/react                  │
│   createBridge · <Wizard> · stepGrammar · currentQuestion         │
│   submit · advance · goBack · jumpTo                              │
│   = Store<Snapshot> + AIAssist + [graph, destructive] middleware  │
├──────────────────────────────────────────────────────────────────┤
│ Layer 2  AI-ASSIST (optional)  @flowgent/core/ai                  │
│   createAIAssist({client}) → suggest() · rewrite() · classify()   │
│   wraps split/polish/classify → confirmable Proposal (P2/P3)      │
├──────────────────────────────────────────────────────────────────┤
│ Layer 1  STORE (core)  @flowgent/core/store   (NO react, NO ai)   │
│   createStore<T>() · mutate(recipe) · undo/redo · applyExternal   │
│   getState/subscribe · middleware pipeline                        │
│   built-in mw: persist · crossTab · destructiveGate               │
│                                                                   │
│   @flowgent/core/graph: entity-graph preset + orphan middleware   │
└──────────────────────────────────────────────────────────────────┘
        canvas / doc / design  ─────────► createStore<T> directly
```

### mutate / undo data flow

```
store.mutate(recipe, {coalesceKey?})
  ├─ produceWithPatches(state, recipe) → { next, patches, inversePatches }
  ├─ ctx = { prev, next, patches, inversePatches, source:'local' }
  ├─ for mw in middleware: if mw.beforeApply(ctx) === false → ABORT (held)
  ├─ commit next; version++
  ├─ undo.push({patches, inversePatches})   // coalesce within coalesceMs; cap maxUndo
  ├─ redo.clear()
  ├─ for mw in middleware: mw.afterApply(ctx)   // persist(debounced), crossTab.broadcast
  └─ notify subscribers

store.undo()  → top = undo.pop(); applyPatches(top.inversePatches); source:'undo';
                redo.push(top); afterApply (persist); notify   // NOT re-pushed to undo
store.applyExternalPatches(patches)  → apply; source:'remote'; NO undo push; notify
   (cross-tab receive + AI proposal commit both route here)
```

## Module layout

```
packages/core/src/
  store/
    index.ts            # createStore, types (Store, Middleware, MutationCtx, Patch)
    undo.ts             # undo/redo stack: coalesce window + maxUndo cap
    middleware/
      persist.ts        # debounced write + never-auto-resume (was patterns/01)
      cross-tab.ts      # BroadcastChannel broadcast/receive + stale reject (was bridge EX5)
      destructive.ts    # beforeApply veto + pending-confirm hold (Pattern 5)
  graph/
    index.ts            # entity-graph preset (Snapshot shape, emptySnapshot, helpers)
    orphan.ts           # orphan-detection middleware (was patterns/04)
  ai/
    index.ts            # createAIClient, split, polish, classify, mapErrorToWizardError (existing)
    assist.ts           # createAIAssist → suggest/rewrite/classify + runAI retry (from bridge EX6)
  react/
    index.ts            # useStore, useStoreSelector, useBridge, <Wizard>, default components
  wizard/
    bridge.ts           # createBridge — strangler facade over store+assist+middleware
    fsm.ts              # nextStep, emitQuestion, step history (goBack/jumpTo)
    types.ts            # WizardConfig, Bridge, BridgeState, Proposal, Question, …
  index.ts              # barrel re-exporting all subpaths (back-compat ".")
```

Deleted/folded: `bridge.ts` private `_applyMutation` (→ store.mutate), `fsm.ts`
`applyPatches` (→ Immer), `patterns/01` and `patterns/04` (→ store/graph middleware).

## Layer 1 — Store API (`@flowgent/core/store`)

```ts
interface StoreOptions<T> {
  initial: T;
  middleware?: Middleware<T>[];
  maxUndo?: number;     // default 100
  coalesceMs?: number;  // default 300
}
interface Store<T> {
  getState(): T;
  subscribe(fn: () => void): () => void;
  mutate(recipe: (draft: T) => void, opts?: { coalesceKey?: string }): void;
  applyExternalPatches(patches: Patch[]): void;   // remote/AI; no undo push
  undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean;
  destroy(): void;
}
interface Middleware<T> {
  name: string;
  beforeApply?(ctx: MutationCtx<T>): boolean | void;  // false = veto/hold
  afterApply?(ctx: MutationCtx<T>): void;
}
interface MutationCtx<T> {
  prev: T; next: T; patches: Patch[]; inversePatches: Patch[];
  source: 'local' | 'remote' | 'undo' | 'redo';
}
```

Built-in middleware: `persist({key, adapter, debounceMs})`, `crossTab({channel})`,
`destructiveGate({isDestructive, onHold})`. `/graph`: `orphanMiddleware()`.

## Layer 2 — AI-assist (`@flowgent/core/ai` → `assist.ts`)

```ts
function createAIAssist(opts: { client?: Anthropic; apiKey?: string; providerBaseURL?: string }): AIAssist;
interface AIAssist {
  suggest(input: string, ctx: SuggestCtx): Promise<Proposal>;  // ai.split → items → proposal
  rewrite(text: string, instruction?: string): Promise<string>; // ai.polish
  classify(input: string, categories: string[]): Promise<string>;
}
```

AI strictly optional: no client/key → `suggest`/`rewrite` reject with
`{kind:'ai-invalid-key'}` (surfaced via the wizard error path) and the store works
with zero AI. `runAI` retry/backoff/`aiStatus` (current EX6 logic) moves here.

## Layer 3 — Wizard strangler (`@flowgent/core/react` + `wizard/`)

`createBridge(config, options, deps)` signature unchanged. Internals:

```
store   = createStore<Snapshot>({ initial: emptySnapshot(),
            middleware: [persist(...), crossTab(...), orphanMiddleware(), destructiveGate(...)],
            maxUndo, coalesceMs })
assist  = options.aiGenerate ? adaptGenerate(options.aiGenerate) : createAIAssist(options)
Bridge methods:
  submit       → assist.suggest → setState({pendingProposal})        (unchanged behavior)
  acceptBatch  → store.applyExternalPatches(proposalToPatches)        (commit + advance)
  editItem/add/regenerateProposal/deleteItem(proposal-item)           (proposal ops, unchanged)
  deleteItem(committed entity) → store.mutate(d => delete d.entities[id])  (orphan mw fires)
  mutate/undo/redo  → store.*                                          (NEW, exposed)
  goBack       → step history pop → emitQuestion(prevStep)             (NEW)
  jumpTo(id)   → validate visited/reachable → emitQuestion(id)         (NEW)
  getState     → { ...store.getState(), currentQuestion, pendingProposal, aiStatus, lastError, recentSkip }
```

`useBridge` subscribes to both store + wizard UI state. Step history is a
`stepId[]` stack the FSM pushes on advance; `goBack`/`jumpTo` are navigation
(entities stay), distinct from store `undo` (reverts state).

## Publishability

- **exports** (`package.json`): `.`, `./store`, `./react`, `./ai`, `./graph` — each `{ types, import }`. `"sideEffects": false`.
- **deps:** `immer` (dep), `@anthropic-ai/sdk` (dep), `react` → `peerDependencies` + `peerDependenciesMeta.react.optional = true` (only `/react` needs it). Drop `fast-json-patch`. `zod` stays for entity schema.
- **build:** `tsc -p tsconfig.build.json` emits each subpath entry to `dist/`; verify `dist/store/index.d.ts` etc. resolve.
- **docs:** rewrite `README.md` (3 layers, install, quickstart for store + wizard + canvas), new `ARCHITECTURE.md` (layer diagram + data flow), `CHANGELOG.md` via changesets, add `LICENSE` (MIT) file.
- **CI:** `.github/workflows` — PR: install/typecheck/test/build; release: `changeset version` + `changeset publish` (npm token secret). `publishConfig.access = public`.
- **version:** `0.0.1 → 0.1.0` (changeset `minor`; pre-1.0 so the breaking patch-type change is acceptable, documented in CHANGELOG).

## Implementation tasks

- [x] **T1 (P1)** — `store/` — `createStore<T>` + `mutate(recipe)` on Immer `produceWithPatches`; getState/subscribe; version. Verify: `vitest store/`.
- [x] **T2 (P1)** — `store/undo.ts` — undo/redo stack with coalesce window + `maxUndo` cap; `applyExternalPatches` bypasses undo. Verify: examples + fast-check round-trip.
- [x] **T3 (P1)** — `store/index.ts` — middleware pipeline: ordered `beforeApply` (veto) + `afterApply`; `MutationCtx`. Verify: veto test blocks a mutation.
- [x] **T4 (P1)** — `store/middleware/{persist,cross-tab,destructive}.ts` — extract from current bridge internals; keep debounce/never-auto-resume/stale-reject behavior. Verify: reuse persistence + cross-tab tests.
- [x] **T5 (P1)** — `graph/{index,orphan}.ts` — entity-graph preset (Snapshot) + orphan middleware (from patterns/04). Verify: orphan tests.
- [x] **T6 (P1)** — `react/index.ts` — `useStore`/`useStoreSelector` (useSyncExternalStore); keep `useBridge`. Verify: use-bridge + new useStore tests, no-tear.
- [x] **T7 (P1)** — `ai/assist.ts` — `createAIAssist` → suggest/rewrite/classify; move `runAI` retry/`aiStatus`. Verify: error-handling tests reused + rewrite/classify tests.
- [ ] **T8 (P1)** — `wizard/bridge.ts` — strangler: reimplement `createBridge` on store+assist+middleware; preserve API. Verify: **all 41 existing tests green**.
- [ ] **T9 (P2)** — `wizard/fsm.ts` — implement `goBack`/`jumpTo` via step-history stack. Verify: nav tests (back, jump, invalid guard).
- [x] **T10 (P2)** — `package.json` exports + build + deps (immer in, fast-json-patch out, react optional). Verify: `pnpm build` emits all subpaths; import-resolution test.
- [ ] **T11 (P2)** — `docs-site` canvas demo on `@flowgent/core/store` directly (drag nodes, undo/redo, no wizard). Verify: `next build` + browse screenshot.
- [x] **T12 (P2)** — README + ARCHITECTURE + CHANGELOG + LICENSE; changeset (minor → 0.1.0). Verify: `changeset status`.
- [x] **T13 (P2)** — CI workflows (PR checks + changeset release) + `publishConfig`. Verify: workflow runs green on PR.

## Test plan (coverage targets)

New: `store/*` (mutate, middleware veto, undo/redo examples + property), `graph/orphan`,
`ai/assist` (suggest/rewrite/classify + AI-optional), `react/useStore` (no-tear),
`wizard` goBack/jumpTo, canvas smoke, publish import-resolution. Reuse: the 41 existing
tests as the strangler regression net (must stay green). Property test (fast-check):
`∀ random recipe seq → undo∘mutate = identity`, `redo∘undo = identity`.

## Failure modes

| Codepath | Failure | Covered? |
|----------|---------|----------|
| `mutate` middleware veto | destructive mutation slips through unconfirmed | test: veto blocks + holds |
| `undo` inverse patches | undo leaves wrong state (Immer edge) | fast-check round-trip |
| `crossTab` receive | stale/echo loop applies old patch | version check + no self-echo + undo-bypass test |
| `persist` | write storm on rapid drags | debounce + coalesce; (P3: patch-based persistence) |
| `assist.suggest` | rate-limit/invalid-key/network | runAI retry + surfaced error (reused tests) |
| `jumpTo` | jump to unvisited/invalid step | validation guard + test |

## What already exists (reuse, not rebuild)

- `_applyMutation` funnel → becomes `store.mutate` (extraction).
- `Snapshot` graph → the `/graph` preset.
- BroadcastChannel sync, debounced persistence, `runAI` retry, `useBridge`,
  `checkOrphans`, `proposalToPatches` → moved, not rewritten.
- `changesets` dep + `.github/` → publish pipeline scaffolding.

## NOT in scope (deferred, with rationale)

- **Multiplayer / CRDT collab** (D1) — different product + innovation token. Future: a `Transport` adapter at the cross-tab seam backed by Yjs. No rework needed (the patch model + middleware seam are forward-compatible).
- **Patch-based persistence** — current full-snapshot debounced write is fine for now; switch to append-patches only if large-state perf shows up (P3 TODO).
- **Two-package split** (`@flowgent/store` + `@flowgent/react`) — subpath exports cover it pre-1.0; revisit if non-React adoption demands it.

## Parallelization

```
Lane A (sequential, store/):   T1 → T2 → T3 → T4
Lane B (independent):          T5 graph/   (after T3's Middleware iface)
Lane C (independent):          T7 ai/assist   (no store dep until wiring)
Barrier → then T6 react/, T8 wizard strangler (need store+assist+graph)
Then:    T9 nav, T11 canvas demo  (parallel) ; T10/T12/T13 publish (parallel, docs)
```
Conflict flag: T4 and T8 both touch wizard-adjacent code — keep sequential.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 7 decisions resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | canvas demo UI not yet reviewed |
| Outside Voice | `/codex` | Independent 2nd opinion | 0 | — | declined |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement. Scope = full (D2). Multiplayer/CRDT deferred (D1). Design review of the new canvas demo recommended before/after T11.

