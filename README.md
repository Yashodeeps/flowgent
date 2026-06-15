# flowgent

**AI Wizard UX patterns** — the missing layer between rigid forms and unstructured chat.

`@flowgent/core` is a small TypeScript library in three independently-usable layers:
a **headless state store** (versioned, undo/redo, cross-tab — powers canvases and
docs), an **optional AI-assist** layer, and a **React wizard** that codifies five UX
contracts every AI-driven multi-step flow needs: never auto-resume drafts, editable
AI confirmations, per-item edit / add / remove / regenerate, orphan-question
detection, destructive-action confirmation.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layer diagram and data flow.

This repo ships:

- **`packages/core`** — `@flowgent/core` on npm. Subpath exports: `/store`, `/react`, `/ai`, `/graph` (the headless store is React-free).
- **`docs-site/`** — three live demos (onboarding, application intake, automation) on the engine, plus a BYOK landing page. Run with `pnpm dev:docs`.
- **`packages/adapter-langgraph`** — opt-in adapter for LangGraph users (planned V1.1).

## Quickstart

```bash
pnpm install
pnpm dev:docs     # opens docs-site on localhost:3000
```

Bring your own Anthropic API key. The docs site has a key input on the landing page; the key is stored in your browser's localStorage and never leaves your machine except for direct calls to `api.anthropic.com`.

## Status

**v0.1.0** — layered architecture landed: headless Store (createStore / mutate /
undo-redo) + middleware (persist, cross-tab, destructive) + entity-graph + optional
AI-assist (suggest / rewrite / classify), with the React wizard composed on top.
Subpath exports (`/store`, `/react`, `/ai`, `/graph`), React as an optional peer.

In progress (see [PLAN.md](./PLAN.md)): the wizard strangler refactor (`createBridge`
moving fully onto the store) and a canvas demo proving the non-wizard surface.

## Article

Coming with V0.1.0 ship. See `ARTICLE.md`.

## License

MIT.
