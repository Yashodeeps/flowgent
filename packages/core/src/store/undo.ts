// Undo/redo history for the Store.
//
// Each local mutation records { patches, inversePatches }. undo() applies the
// inverse; redo() re-applies the forward patches. Two policies keep it bounded
// and gesture-shaped (decision 7):
//   - coalesce: consecutive entries sharing a coalesceKey within coalesceMs
//     merge into one, so a continuous drag is a single undo step.
//   - cap: at most maxUndo entries; the oldest is dropped.
//
// History stores patches only — it never holds full state, so memory stays
// bounded regardless of state size.

import type { Patch } from 'immer';

export interface UndoEntry {
  patches: Patch[]; // forward (redo)
  inversePatches: Patch[]; // reverse (undo)
  coalesceKey?: string;
  time: number;
}

export class History {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];

  constructor(
    private readonly maxUndo: number,
    private readonly coalesceMs: number,
  ) {}

  // Record a local mutation. Clears the redo stack (new branch of history).
  record(entry: UndoEntry): void {
    this.redoStack = [];
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      top &&
      entry.coalesceKey != null &&
      top.coalesceKey === entry.coalesceKey &&
      entry.time - top.time <= this.coalesceMs
    ) {
      // Merge into the previous gesture. Forward = top ++ new; to undo the
      // merged entry we must reverse new first, then top.
      top.patches = [...top.patches, ...entry.patches];
      top.inversePatches = [...entry.inversePatches, ...top.inversePatches];
      top.time = entry.time;
      return;
    }
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
  }

  // Pop one undo entry (moves it to the redo stack). Caller applies inversePatches.
  undo(): UndoEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return entry;
  }

  // Pop one redo entry (moves it back to the undo stack). Caller applies patches.
  redo(): UndoEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return entry;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
