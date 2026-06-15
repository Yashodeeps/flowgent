// Default PlanStrip. Day 2 polishes. Renders entities + recentSkip toast.

import type { RecentSkip, Snapshot } from '../types.js';

export function DefaultPlanStrip({
  snapshot,
  recentSkip,
}: {
  snapshot: Snapshot;
  recentSkip?: RecentSkip | null;
}) {
  const entities = Object.values(snapshot.entities);
  return (
    <div className="flowgent-plan-strip">
      <div className="flowgent-plan-strip__entities">
        {entities.length === 0 ? (
          <p>No items yet.</p>
        ) : (
          <ul>
            {entities.map((e) => (
              <li key={e.id}>
                <strong>{e.kind}</strong> · {e.id}
              </li>
            ))}
          </ul>
        )}
      </div>
      {recentSkip ? (
        <div className="flowgent-plan-strip__skip-toast" role="status">
          Skipped question — {recentSkip.reason}
        </div>
      ) : null}
    </div>
  );
}
