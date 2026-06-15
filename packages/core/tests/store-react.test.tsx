// React bindings: useStore (whole state) + useStoreSelector (derived slice,
// no re-render on unrelated changes).

import { cleanup, act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createStore, type Store } from '../src/store/index.js';
import { useStore, useStoreSelector } from '../src/react/index.js';

afterEach(cleanup);

interface S {
  count: number;
  other: number;
}
const make = (): Store<S> => createStore<S>({ initial: { count: 0, other: 0 } });

describe('useStore', () => {
  it('returns initial state and re-renders on mutation', async () => {
    const store = make();
    function P() {
      const s = useStore(store);
      return <div data-testid="v">{s.count}</div>;
    }
    render(<P />);
    expect(screen.getByTestId('v').textContent).toBe('0');
    await act(async () => {
      store.mutate((d) => void (d.count = 4));
    });
    expect(screen.getByTestId('v').textContent).toBe('4');
  });
});

describe('useStoreSelector', () => {
  it('renders the selected slice and does NOT re-render on unrelated changes', async () => {
    const store = make();
    let renders = 0;
    function P() {
      renders += 1;
      const count = useStoreSelector(store, (s) => s.count);
      return <div data-testid="c">{count}</div>;
    }
    render(<P />);
    const initialRenders = renders;
    expect(screen.getByTestId('c').textContent).toBe('0');

    // Mutating an unrelated field must not re-render this component.
    await act(async () => {
      store.mutate((d) => void (d.other = 99));
    });
    expect(renders).toBe(initialRenders);
    expect(screen.getByTestId('c').textContent).toBe('0');

    // Mutating the selected field re-renders.
    await act(async () => {
      store.mutate((d) => void (d.count = 1));
    });
    expect(renders).toBe(initialRenders + 1);
    expect(screen.getByTestId('c').textContent).toBe('1');
  });
});
