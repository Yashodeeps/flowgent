// EX10: localStorage debounce policy at the Bridge level. Pattern 1 round-trip
// (markSession ↔ shouldResume) is covered in 01-no-auto-resume.test.ts; this
// file verifies the debounce/flush behavior of the Bridge write path.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inMemoryAdapter, makeBridge } from './helpers.js';
import type { Bridge } from '../src/types.js';

describe('Bridge — localStorage debounce (EX10)', () => {
  let bridge: Bridge | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    bridge?.destroy();
    bridge = null;
    vi.useRealTimers();
  });

  it('localStorage write fires once per 150ms debounce window', () => {
    const adapter = inMemoryAdapter();
    const write = vi.spyOn(adapter, 'write');
    bridge = makeBridge({ adapter, debounceMs: 150 });

    void bridge.submit('a');
    expect(write).not.toHaveBeenCalled(); // debounced

    vi.advanceTimersByTime(149);
    expect(write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1); // fires at 150ms
  });

  it('beforeunload flushes pending write', () => {
    const adapter = inMemoryAdapter();
    const write = vi.spyOn(adapter, 'write');
    bridge = makeBridge({ adapter, debounceMs: 150 });

    void bridge.submit('a');
    expect(write).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('beforeunload'));
    expect(write).toHaveBeenCalledTimes(1); // flushed immediately

    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1); // timer was cleared — no double write
  });

  it('rapid successive patches batch into one storage write', () => {
    const adapter = inMemoryAdapter();
    const write = vi.spyOn(adapter, 'write');
    bridge = makeBridge({ adapter, debounceMs: 150 });

    void bridge.submit('a');
    void bridge.submit('b');
    void bridge.submit('c');
    expect(write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1); // three patches → one write
  });
});
