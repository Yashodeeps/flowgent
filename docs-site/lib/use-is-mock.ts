'use client';

import { useEffect, useState } from 'react';

// SSR-safe `?mock=1` detection. Reading window.location.search during the
// initial render causes a hydration mismatch: the server has no window (→ false)
// while the client sees the query (→ true), so React's first client render
// disagrees with the server HTML. Start false to match SSR, then read after
// mount. Use this only where `mock` is consumed at call-time (event handlers);
// when it feeds a one-time store/bridge initializer, pass it as a prop from the
// server page instead so the value is correct on the very first render.
export function useIsMock(): boolean {
  const [mock, setMock] = useState(false);
  useEffect(() => {
    setMock(new URLSearchParams(window.location.search).has('mock'));
  }, []);
  return mock;
}
