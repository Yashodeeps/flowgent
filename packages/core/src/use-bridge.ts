// useBridge: React hook for subscribing to Bridge state without tearing.
// EX2: built on useSyncExternalStore to safely handle concurrent React.

import { useSyncExternalStore } from 'react';
import type { Bridge, BridgeState } from './types.js';

export function useBridge(bridge: Bridge): BridgeState {
  return useSyncExternalStore(
    (listener) => bridge.subscribe(listener),
    () => bridge.getState(),
    () => bridge.getState(),
  );
}
