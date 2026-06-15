# flowgent

**AI Wizard UX patterns** — the missing layer between rigid forms and unstructured chat.

`@flowgent/core` is a small TypeScript library that codifies five UX contracts every AI-driven multi-step flow needs: never auto-resume drafts, editable AI confirmations, per-item edit / re-ask / regenerate / delete, orphan-question detection, destructive-action confirmation.

This repo ships:

- **`packages/core`** — `@flowgent/core` on npm. The engine: FSM, Bridge, the 5 pattern modules, default UI primitives, `useBridge()` hook, `<Wizard>` component.
- **`examples/`** — three runnable Next.js apps using `@flowgent/core` (onboarding, insurance/legal intake, agent-spec).
- **`docs-site/`** — the live demo + docs site (Vercel-deployed at `flowgent.dev`).
- **`packages/adapter-langgraph`** — opt-in adapter for LangGraph users (V1.1).

## Quickstart

```bash
pnpm install
pnpm dev:docs     # opens docs-site on localhost:3000
```

Bring your own Anthropic API key. The docs site has a key input on the landing page; the key is stored in your browser's localStorage and never leaves your machine except for direct calls to `api.anthropic.com`.

## Status

V0.0.1 — scaffold complete. Day-1 deliverables landed: monorepo, `@flowgent/core` skeleton with types + FSM + Pattern 1 + bridge subscribe plumbing + `useBridge()` hook + `<Wizard>` component + CI.

Track progress in `~/.gstack/projects/flowgent/yashodeep-no-git-design-20260524-014618.md` (the design doc, Tasks section, T1–T10).

## Article

Coming with V0.1.0 ship. See `ARTICLE.md`.

## License

MIT.
