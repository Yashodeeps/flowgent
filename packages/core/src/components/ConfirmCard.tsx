// Default ConfirmCard — Pattern 2 + 3 render surface. Day 2 fills in the real
// edit / accept / reject UI. Day 1 ships a placeholder so the component map
// satisfies UIComponentMap.

import type { Proposal } from '../types.js';

export function DefaultConfirmCard({
  proposal,
  onAccept,
  onReject,
  onEditItem,
}: {
  proposal: Proposal;
  onAccept: () => void;
  onReject: () => void;
  onEditItem: (itemId: string, text: string) => void;
}) {
  return (
    <div className="flowgent-confirm-card">
      <p>Review what the AI proposed:</p>
      <ul>
        {proposal.items.map((item) => (
          <li key={item.id}>
            <input
              type="text"
              value={item.text}
              onChange={(e) => onEditItem(item.id, e.target.value)}
            />
          </li>
        ))}
      </ul>
      <button type="button" onClick={onAccept}>
        Accept all
      </button>
      <button type="button" onClick={onReject}>
        Discard
      </button>
    </div>
  );
}
