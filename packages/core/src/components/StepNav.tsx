// Default StepNav — Day 4 wires real jump-to-step UI. Day 1 placeholder.

import type { Snapshot } from '../types.js';

export function DefaultStepNav({
  snapshot,
  onJump,
}: {
  snapshot: Snapshot;
  onJump: (stepId: string) => void;
}) {
  return (
    <nav className="flowgent-step-nav" aria-label="Wizard steps">
      <p>
        v{snapshot.version} · {snapshot.history.length} patches
      </p>
      <button type="button" onClick={() => onJump('')}>
        Restart
      </button>
    </nav>
  );
}
