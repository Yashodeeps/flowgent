// @flowgent/core/react — React bindings for the Store (and, after the strangler
// refactor, the Wizard). Built on useSyncExternalStore so reads never tear in
// concurrent React.

import { useRef, useSyncExternalStore } from 'react';
import type { Store } from '../store/index.js';

// Wizard React surface (Layer 3) — re-exported so `@flowgent/core/react` is the
// single React entry point.
export { useBridge } from '../use-bridge.js';
export { Wizard } from '../components/Wizard.js';
export { useComponents } from '../components/components-context.js';
export { DefaultQuestionCard } from '../components/QuestionCard.js';
export { DefaultPlanStrip } from '../components/PlanStrip.js';
export { DefaultConfirmCard } from '../components/ConfirmCard.js';
export { DefaultStepNav } from '../components/StepNav.js';

// Subscribe to the whole store state.
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

// Subscribe to a derived slice. The selector is recomputed only when the store
// state reference changes (Immer gives a new ref per mutation), so an object
// selector returns a stable ref between unrelated updates — no render loop.
export function useStoreSelector<T, S>(store: Store<T>, selector: (state: T) => S): S {
  const cache = useRef<{ state: T; value: S } | null>(null);
  const getSnapshot = (): S => {
    const state = store.getState();
    if (!cache.current || cache.current.state !== state) {
      cache.current = { state, value: selector(state) };
    }
    return cache.current.value;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
