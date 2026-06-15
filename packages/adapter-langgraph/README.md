# @flowgent/langgraph

**Status: V1.1 placeholder. Not implemented yet.**

This adapter will provide a typed bridge for users already running LangGraph
server-side: take your LangGraph state, get a flowgent `Snapshot`, and let
flowgent's bridge patterns (orphan detection, editable AI confirmation, etc.)
ride on top.

Tracking issue: TBD after V1 ship.

For V1, flowgent uses a hand-rolled tree-walking FSM. See `@flowgent/core/src/fsm.ts`.
