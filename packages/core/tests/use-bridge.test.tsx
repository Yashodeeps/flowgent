// EX2: useBridge() subscribe / re-render / unsubscribe lifecycle, against
// happy-dom + @testing-library/react.

import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBridge } from '../src/use-bridge.js';
import { makeBridge, makeItem } from './helpers.js';
import type { Bridge } from '../src/types.js';

afterEach(cleanup);

function Probe({ bridge }: { bridge: Bridge }) {
  const state = useBridge(bridge);
  return (
    <div>
      <span data-testid="v">v{state.snapshot.version}</span>
      <span data-testid="p">
        {state.pendingProposal ? state.pendingProposal.items.length : 'none'}
      </span>
    </div>
  );
}

describe('useBridge() — subscribe / unsubscribe lifecycle', () => {
  it('subscribes on mount, returns initial state', () => {
    const bridge = makeBridge();
    render(<Probe bridge={bridge} />);
    expect(screen.getByTestId('v').textContent).toBe('v0');
    expect(screen.getByTestId('p').textContent).toBe('none');
  });

  it('re-renders when bridge state changes', async () => {
    const bridge = makeBridge({ aiGenerate: async () => [makeItem('e1', 'design')] });
    render(<Probe bridge={bridge} />);
    expect(screen.getByTestId('p').textContent).toBe('none');

    await act(async () => {
      await bridge.submit('x'); // stages a proposal → component re-renders
    });

    expect(screen.getByTestId('p').textContent).toBe('1');
  });

  it('unsubscribes on unmount', () => {
    const bridge = makeBridge();
    const realSubscribe = bridge.subscribe.bind(bridge);
    const unsub = vi.fn();
    bridge.subscribe = (listener) => {
      const teardown = realSubscribe(listener);
      return () => {
        unsub();
        teardown();
      };
    };

    const { unmount } = render(<Probe bridge={bridge} />);
    unmount();
    expect(unsub).toHaveBeenCalled();
  });

  it('does not tear in React concurrent mode (useSyncExternalStore guarantee)', async () => {
    const bridge = makeBridge({ aiGenerate: async () => [makeItem('e1', 'design')] });
    render(
      <StrictMode>
        <Probe bridge={bridge} />
      </StrictMode>,
    );
    // Rendered value always equals the single source of truth — no torn read.
    expect(screen.getByTestId('v').textContent).toBe(`v${bridge.getState().snapshot.version}`);

    await act(async () => {
      await bridge.submit('x');
      await bridge.acceptBatch(bridge.getState().pendingProposal!); // commit → v1
    });

    expect(screen.getByTestId('v').textContent).toBe(`v${bridge.getState().snapshot.version}`);
    expect(screen.getByTestId('v').textContent).toBe('v1');
  });
});
