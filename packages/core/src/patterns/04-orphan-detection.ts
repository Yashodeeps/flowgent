// Pattern 4: orphan-question detection.
//
// Contract:
//   - A Question may depend on an entity (Question.dependsOn: EntityId). The
//     question only makes sense while that entity exists.
//   - When a mutation removes the depended-on entity (e.g. the user deletes the
//     workspace a follow-up question was about), the in-flight question is now
//     an "orphan" — answering it would attach data to something that's gone.
//   - checkOrphans() detects this so the Bridge can skip the question and
//     surface a RecentSkip toast instead of silently dropping it.
//
// This file is canonical — bridge.ts calls checkOrphans() inside its single
// _applyMutation() funnel (EX3), so EVERY mutation is orphan-checked by
// construction. Adding a new mutation method cannot bypass this.

import type { OrphanCheck, Question, Snapshot } from '../types.js';

export function checkOrphans(
  snapshot: Snapshot,
  currentQuestion: Question | null,
): OrphanCheck {
  // No active question, or a question that depends on nothing, can't be orphaned.
  if (!currentQuestion || !currentQuestion.dependsOn) {
    return { isOrphan: false };
  }
  const dep = currentQuestion.dependsOn;
  if (snapshot.entities[dep]) {
    return { isOrphan: false };
  }
  return {
    isOrphan: true,
    reason: `Question "${currentQuestion.prompt}" depended on entity ${dep}, which was removed.`,
    deletedEntityId: dep,
  };
}
