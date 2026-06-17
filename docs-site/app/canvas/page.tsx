// Canvas demo — the SAME engine as the wizards, with no wizard and no AI.
// Just @flowgent/core's headless store driving a direct-manipulation surface:
// drag nodes (one drag = one undo), add/rename/delete, undo/redo, live cross-tab.

'use client';

import { useEffect, useRef, useState } from 'react';
import { createStore, type Store } from '@flowgent/core/store';
// persist + crossTab live on the barrel in 0.1.0; they move to /store in 0.2.0.
import { persist, crossTab } from '@flowgent/core';
import { useStore } from '@flowgent/core/react';
import { Back, Grid, Plus, Redo, Undo, X } from '../../components/icons';

interface CNode {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}
interface CanvasDoc {
  nodes: Record<string, CNode>;
}

const COLORS = ['#0b66c2', '#15803d', '#b45309', '#7c3aed', '#be123c'];
const LABELS = ['Idea', 'Task', 'Note', 'Goal', 'Block', 'Draft'];

function makeNode(i: number): CNode {
  return {
    id: crypto.randomUUID(),
    x: 60 + (i % 4) * 158,
    y: 48 + Math.floor(i / 4) * 104,
    label: LABELS[i % LABELS.length]!,
    color: COLORS[i % COLORS.length]!,
  };
}
function starter(): CanvasDoc {
  const nodes: Record<string, CNode> = {};
  for (let i = 0; i < 3; i++) {
    const n = makeNode(i);
    nodes[n.id] = n;
  }
  return { nodes };
}

export default function CanvasPage() {
  const [store] = useState<Store<CanvasDoc>>(() =>
    createStore<CanvasDoc>({
      initial: starter(),
      middleware: [persist({ key: 'flowgent:canvas' }), crossTab({ channel: 'flowgent:canvas' })],
    }),
  );
  const state = useStore(store);
  const nodes = Object.values(state.nodes);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => () => store.destroy(), [store]);

  // Drag: each move coalesces into one undo step keyed to the node.
  useEffect(() => {
    if (!dragId) return;
    function onMove(e: MouseEvent) {
      const d = drag.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const x = Math.max(0, Math.min(rect.width - 60, e.clientX - rect.left - d.dx));
      const y = Math.max(0, Math.min(rect.height - 36, e.clientY - rect.top - d.dy));
      store.mutate(
        (doc) => {
          const node = doc.nodes[d.id];
          if (node) {
            node.x = x;
            node.y = y;
          }
        },
        { coalesceKey: `drag-${d.id}` },
      );
    }
    function onUp() {
      drag.current = null;
      setDragId(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragId, store]);

  function startDrag(e: React.MouseEvent, n: CNode) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y };
    setDragId(n.id);
    setSelected(n.id);
  }
  function addNode() {
    const n = makeNode(nodes.length);
    store.mutate((d) => {
      d.nodes[n.id] = n;
    });
    setSelected(n.id);
  }
  function removeNode(id: string) {
    store.mutate((d) => {
      delete d.nodes[id];
    });
    if (selected === id) setSelected(null);
  }
  function rename(id: string, label: string) {
    store.mutate((d) => {
      const n = d.nodes[id];
      if (n) n.label = label;
    });
  }

  return (
    <main className="fg-page">
      <div className="fg-topbar">
        <a className="fg-back" href="/">
          <Back width={15} /> All demos
        </a>
        <div className="fg-topbar__spacer" />
        <span className="fg-pill">
          <span className="fg-pill__dot" /> @flowgent/core/store · no wizard, no AI
        </span>
      </div>

      <div className="fg-hero" style={{ marginBottom: 16 }}>
        <p className="fg-plan__eyebrow">flowgent demo · canvas</p>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '6px 0 6px', fontWeight: 700 }}>
          Headless store canvas
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 700, margin: 0, lineHeight: 1.5 }}>
          The same engine as the wizards — but no wizard, no AI. Just{' '}
          <code className="fg-code">createStore</code> from{' '}
          <code className="fg-code">@flowgent/core/store</code>. Drag nodes (one drag = one undo),
          add, rename, delete, undo/redo.
        </p>
      </div>

      <div className="fg-toolbar">
        <button className="fg-toolbtn fg-toolbtn--primary" onClick={addNode}>
          <Plus width={15} /> Add node
        </button>
        <div className="fg-toolbar__sep" />
        <button className="fg-toolbtn" onClick={() => store.undo()} disabled={!store.canUndo()}>
          <Undo width={15} /> Undo
        </button>
        <button className="fg-toolbtn" onClick={() => store.redo()} disabled={!store.canRedo()}>
          <Redo width={15} /> Redo
        </button>
        <span className="fg-toolbar__count">
          {nodes.length} node{nodes.length !== 1 ? 's' : ''} · v{store.getVersion()}
        </span>
      </div>

      <div className="fg-canvas" ref={canvasRef} onMouseDown={() => setSelected(null)}>
        {nodes.length === 0 ? (
          <div className="fg-canvas__empty">Empty canvas — add a node, then undo the delete.</div>
        ) : null}
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`fg-cnode ${dragId === n.id ? 'fg-cnode--dragging' : ''} ${
              selected === n.id ? 'fg-cnode--selected' : ''
            }`}
            style={{ left: n.x, top: n.y, borderLeftColor: n.color }}
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag(e, n);
            }}
          >
            <input
              className="fg-cnode__label"
              value={n.label}
              onChange={(e) => rename(n.id, e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              className="fg-cnode__del"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => removeNode(n.id)}
              aria-label="Delete node"
            >
              <X width={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="fg-canvas-note">
        <Grid width={14} /> Open this page in a second tab and drag — edits mirror live via the
        store&apos;s cross-tab middleware. Reload starts fresh (Pattern 1: never auto-resume).
      </div>
    </main>
  );
}
