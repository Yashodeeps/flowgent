# @flowgent/core

**AI Wizard UX patterns** — a headless state store, optional AI-assist, and a React
wizard, in three layers you can adopt independently. The same engine powers linear
AI wizards **and** direct-manipulation surfaces like canvases and docs.

```bash
npm install @flowgent/core
# AI features also need: npm install @anthropic-ai/sdk
# React layers need react >= 18 (an optional peer)
```

## Three layers

```
@flowgent/core/store   Layer 1  headless: createStore + mutate + undo/redo + middleware
@flowgent/core/graph            entity-graph preset + orphan detection
@flowgent/core/ai               AI primitives (split/polish/classify) — React-free
@flowgent/core         Layer 2+3  createAIAssist + the React wizard (createBridge, <Wizard>)
@flowgent/core/react            React bindings: useStore, useBridge, <Wizard>
```

Pick the layer you need. A canvas uses only `/store`. A server route uses only `/ai`.
A wizard app uses the top layer. React is an **optional peer** — the store and AI
primitives are React-free.

## Layer 1 — the Store (no React, no AI)

A versioned state container with one mutation funnel: every change runs through
middleware, records an inverse patch for undo, bumps a version, and notifies
subscribers. Built on [Immer](https://immerjs.github.io/immer/).

```ts
import { createStore, persist, crossTab } from '@flowgent/core/store';

interface CanvasDoc {
  nodes: Record<string, { x: number; y: number; label: string }>;
}

const store = createStore<CanvasDoc>({
  initial: { nodes: {} },
  middleware: [persist({ key: 'canvas' }), crossTab({ channel: 'canvas' })],
  maxUndo: 100,
  coalesceMs: 300, // a continuous drag becomes one undo step
});

store.mutate((d) => {
  d.nodes.a = { x: 0, y: 0, label: 'Hello' };
});
store.mutate((d) => {
  d.nodes.a.x = 240;
}, { coalesceKey: 'drag-a' });

store.undo(); // back to x: 0
store.redo();
```

Middleware is a `{ beforeApply?, afterApply? }` lifecycle object; `beforeApply`
returning `false` vetoes a mutation (how destructive-confirm holds a delete until
the user confirms). Cross-tab edits and AI commits go through
`store.applyExternalPatches()` and stay off the local undo stack.

## React bindings

```tsx
import { useStore, useStoreSelector } from '@flowgent/core/react';
import type { Store } from '@flowgent/core/store';

function NodeCount({ store }: { store: Store<CanvasDoc> }) {
  const count = useStoreSelector(store, (s) => Object.keys(s.nodes).length);
  return <span>{count} nodes</span>;
}
```

`useStore` / `useStoreSelector` are built on `useSyncExternalStore` (no tearing in
concurrent React). A selector only re-renders when its slice changes.

## Layer 2 — AI-assist (optional)

```ts
import { createAIAssist } from '@flowgent/core';

const assist = createAIAssist({ apiKey: process.env.ANTHROPIC_API_KEY });
const items = await assist.suggest('design, eng, and a marketing team', {
  prompt: 'Split into distinct teams.',
  kind: 'team',
});
const cleaner = await assist.rewrite('make this nicer plz');
```

`suggest`/`rewrite`/`classify` wrap Claude with retry/backoff and a normalized error
surface. Bring your own key — calls go directly to `api.anthropic.com`.

## Layer 3 — the React wizard

```tsx
import { createBridge, Wizard } from '@flowgent/core';

const bridge = createBridge(config, { apiKey, aiGenerate });
bridge.start();
// <Wizard config={config} bridge={bridge} />
```

The wizard composes the store + AI-assist + the five UX contracts:

1. **Never auto-resume drafts** — persist, but make resuming explicit.
2. **Editable AI confirmations** — the user reviews a proposal before anything commits.
3. **Per-item edit / add / remove / regenerate** on a pending proposal.
4. **Orphan-question detection** — skip a question whose entity was deleted.
5. **Destructive-action confirmation.**

## API surface

| Import | Gives you |
|--------|-----------|
| `@flowgent/core/store` | `createStore`, `Store`, `Middleware`, `persist`, `crossTab`, `destructiveGate` |
| `@flowgent/core/graph` | `emptyGraph`, `addEntity`, `removeEntity`, `orphanMiddleware`, `Entity` |
| `@flowgent/core/ai` | `createAIClient`, `split`, `polish`, `classify` (React-free) |
| `@flowgent/core/react` | `useStore`, `useStoreSelector`, `useBridge`, `<Wizard>` |
| `@flowgent/core` | everything above + `createBridge`, `createAIAssist` |

## License

MIT.
