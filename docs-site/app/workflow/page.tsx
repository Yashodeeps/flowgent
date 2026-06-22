// AI workflow builder — the dynamic AI + canvas demo, grounded in a real product
// category (n8n / Zapier / Make all ship AI flow-generation). Describe an
// automation; the AI lays out the connected steps; you drag, wire (drag a node's
// handle to another), rename, retype, delete. The flow (nodes + edges) lives in
// ONE @flowgent/core store — AI generation and every manual edit share one undo
// stack. The connections ARE the product.

'use client';

import { useEffect, useRef, useState } from 'react';
import { createStore, type Store } from '@flowgent/core/store';
import { persist, crossTab } from '@flowgent/core';
import { createAIClient } from '@flowgent/core/ai';
import { useStore } from '@flowgent/core/react';
import { KEY_STORAGE } from '../../lib/demos';
import { useIsMock } from '../../lib/use-is-mock';
import { Back, Plus, Redo, Undo, Warn, X } from '../../components/icons';

type Kind = 'trigger' | 'action' | 'condition';
interface WNode {
  id: string;
  label: string;
  kind: Kind;
  x: number;
  y: number;
}
interface WEdge {
  from: string;
  to: string;
}
interface Flow {
  nodes: Record<string, WNode>;
  edges: WEdge[];
}

const NODE_W = 156;
const NODE_H = 52;
const KIND_COLOR: Record<Kind, string> = {
  trigger: '#15803d',
  action: '#0b66c2',
  condition: '#b45309',
};
const KINDS: Kind[] = ['trigger', 'action', 'condition'];
const center = (n: WNode) => ({ x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 });

const EXAMPLES = [
  {
    label: 'Support triage',
    prompt: "When a customer emails support, classify it, and if it's urgent page the on-call, otherwise draft a reply.",
  },
  {
    label: 'PR checks',
    prompt: 'When a pull request opens, run the tests; if they pass request a review, otherwise comment with the failures.',
  },
  {
    label: 'Lead sync',
    prompt: "Every morning, pull yesterday's signups, enrich each with company info, then add them to the CRM.",
  },
];

function mockFlow(): Flow {
  const id = () => crypto.randomUUID();
  const a = id(), b = id(), c = id(), d = id(), e = id();
  const nodes: Record<string, WNode> = {
    [a]: { id: a, label: 'New support email', kind: 'trigger', x: 200, y: 22 },
    [b]: { id: b, label: 'Classify the request', kind: 'action', x: 200, y: 128 },
    [c]: { id: c, label: 'Urgent?', kind: 'condition', x: 200, y: 234 },
    [d]: { id: d, label: 'Page the on-call', kind: 'action', x: 36, y: 350 },
    [e]: { id: e, label: 'Draft a reply', kind: 'action', x: 364, y: 350 },
  };
  return {
    nodes,
    edges: [
      { from: a, to: b },
      { from: b, to: c },
      { from: c, to: d },
      { from: c, to: e },
    ],
  };
}

const SYS =
  'You design an automation as a flow of steps. Return ONLY JSON, no prose and no code fences: ' +
  '{"steps":[{"label":"short imperative, under 5 words","kind":"trigger|action|condition"}],"flow":[[fromIndex,toIndex]]}. ' +
  'Step 0 is the trigger. flow lists directed connections by step index.';

async function genFlow(input: string, mock: boolean): Promise<Flow> {
  if (mock) {
    await new Promise((r) => setTimeout(r, 500));
    return mockFlow();
  }
  const key = typeof window !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  if (!key) throw { kind: 'ai-invalid-key' };
  const client = createAIClient({ apiKey: key });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: SYS,
    messages: [{ role: 'user', content: input }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  let raw = (block && block.type === 'text' ? block.text : '{}').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1]!.trim();
  let o: { steps?: unknown; flow?: unknown } = {};
  try {
    o = JSON.parse(raw);
  } catch {
    o = {};
  }
  const steps = Array.isArray(o.steps) ? (o.steps as Array<Record<string, unknown>>) : [];
  const ids = steps.map(() => crypto.randomUUID());
  const nodes: Record<string, WNode> = {};
  steps.forEach((s, i) => {
    const kind = (KINDS as string[]).includes(String(s.kind)) ? (s.kind as Kind) : i === 0 ? 'trigger' : 'action';
    nodes[ids[i]!] = { id: ids[i]!, label: String(s.label ?? `Step ${i + 1}`), kind, x: 200, y: 22 + i * 100 };
  });
  const flow = Array.isArray(o.flow) ? (o.flow as unknown[]) : [];
  const edges: WEdge[] = [];
  for (const pair of flow) {
    if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') {
      const f = ids[pair[0]], t = ids[pair[1]];
      if (f && t && f !== t) edges.push({ from: f, to: t });
    }
  }
  if (edges.length === 0) for (let i = 0; i < ids.length - 1; i++) edges.push({ from: ids[i]!, to: ids[i + 1]! });
  return { nodes, edges };
}

export default function WorkflowPage() {
  const mock = useIsMock();
  const [store] = useState<Store<Flow>>(() =>
    createStore<Flow>({
      initial: { nodes: {}, edges: [] },
      middleware: [persist({ key: 'flowgent:workflow' }), crossTab({ channel: 'flowgent:workflow' })],
    }),
  );
  const state = useStore(store);
  const nodes = Object.values(state.nodes);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (mock || localStorage.getItem(KEY_STORAGE)) {
      setHasKey(true);
      return;
    }
    fetch('/api/anthropic')
      .then((r) => r.json())
      .then((d) => setHasKey(Boolean(d.hasServerKey)))
      .catch(() => setHasKey(false));
  }, [mock]);
  useEffect(() => () => store.destroy(), [store]);

  // drag a node
  useEffect(() => {
    if (!dragId) return;
    function onMove(e: MouseEvent) {
      const d = drag.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const x = Math.max(0, Math.min(rect.width - NODE_W, e.clientX - rect.left - d.dx));
      const y = Math.max(0, Math.min(rect.height - NODE_H, e.clientY - rect.top - d.dy));
      store.mutate(
        (doc) => {
          const n = doc.nodes[d.id];
          if (n) {
            n.x = x;
            n.y = y;
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

  // connect a node to another by dragging its handle
  useEffect(() => {
    if (!connectFrom) return;
    function onMove(e: MouseEvent) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    function onUp() {
      // node onMouseUp (fired first) creates the edge; this just clears.
      setConnectFrom(null);
      setCursor(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [connectFrom]);

  async function generate() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const flow = await genFlow(input.trim(), mock);
      store.mutate((d) => {
        d.nodes = flow.nodes;
        d.edges = flow.edges;
      });
    } catch (e) {
      const kind = (e as { kind?: string })?.kind;
      setError(
        kind === 'ai-invalid-key'
          ? 'No API key — add one on the home page, or append ?mock=1.'
          : 'Could not reach Claude. Try again, or use ?mock=1.',
      );
    } finally {
      setBusy(false);
    }
  }

  function startDrag(e: React.MouseEvent, n: WNode) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y };
    setDragId(n.id);
  }
  function onNodeMouseUp(id: string) {
    if (connectFrom && connectFrom !== id) {
      store.mutate((d) => {
        if (!d.edges.some((ed) => ed.from === connectFrom && ed.to === id)) d.edges.push({ from: connectFrom, to: id });
      });
    }
    setConnectFrom(null);
  }
  const addStep = () =>
    store.mutate((d) => {
      const i = Object.keys(d.nodes).length;
      const id = crypto.randomUUID();
      d.nodes[id] = { id, label: 'New step', kind: 'action', x: 30 + (i % 3) * 168, y: 30 + Math.floor(i / 3) * 96 };
    });
  const removeNode = (id: string) =>
    store.mutate((d) => {
      delete d.nodes[id];
      d.edges = d.edges.filter((e) => e.from !== id && e.to !== id);
    });
  const removeEdge = (i: number) => store.mutate((d) => void d.edges.splice(i, 1));
  const rename = (id: string, label: string) =>
    store.mutate((d) => void (d.nodes[id] && (d.nodes[id]!.label = label)));
  const cycleKind = (id: string) =>
    store.mutate((d) => {
      const n = d.nodes[id];
      if (n) n.kind = KINDS[(KINDS.indexOf(n.kind) + 1) % KINDS.length]!;
    });

  function edgeGeom(s: WNode, t: WNode) {
    const c1 = center(s), c2 = center(t);
    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const R = 32;
    return { x1: c1.x + ux * R, y1: c1.y + uy * R, x2: c2.x - ux * R, y2: c2.y - uy * R };
  }

  return (
    <main className="fg-page" style={{ maxWidth: 1180 }}>
      <div className="fg-topbar">
        <a className="fg-back" href="/">
          <Back width={15} /> All demos
        </a>
        <div className="fg-topbar__spacer" />
        <span className="fg-pill">
          <span className="fg-pill__dot" /> {mock ? 'Preview · no key' : 'Store + AI · one flow, one undo stack'}
        </span>
      </div>

      <div className="fg-hero" style={{ marginBottom: 16 }}>
        <p className="fg-plan__eyebrow">flowgent demo · workflow builder</p>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '6px 0 6px', fontWeight: 700 }}>
          AI workflow builder
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 720, margin: 0, lineHeight: 1.5 }}>
          Describe an automation; the AI lays out the connected steps. Drag to arrange, drag a node&apos;s
          bottom handle onto another to wire them, click a step&apos;s tag to change its type, click a line to
          delete it. The flow lives in one <code className="fg-code">@flowgent/core</code> store — AI and your
          edits share <strong>one undo stack</strong>.
        </p>
      </div>

      <div className="fg-studio">
        <aside className="fg-studio__panel">
          <h2 className="fg-studio__h">Describe the automation</h2>
          <p className="fg-studio__sub">e.g. &ldquo;when a customer emails support, triage it and draft a reply&rdquo;</p>
          {!hasKey && !mock ? (
            <div className="fg-keywarn" style={{ marginBottom: 12 }}>
              <Warn width={15} />
              <div>
                No API key. <a href="/">Add one</a> or append <code>?mock=1</code>.
              </div>
            </div>
          ) : null}
          <textarea
            className="fg-input"
            value={input}
            placeholder="When a customer emails support, classify it, and if it's urgent page the on-call, otherwise draft a reply."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
            }}
            disabled={busy}
          />
          <div className="fg-examples">
            <span className="fg-examples__label">Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} className="fg-example" onClick={() => setInput(ex.prompt)} disabled={busy}>
                {ex.label}
              </button>
            ))}
          </div>
          <div className="fg-actions" style={{ marginTop: 12 }}>
            {busy ? (
              <div className="fg-thinking">
                <span className="fg-spinner" /> Designing the flow…
              </div>
            ) : (
              <span className="fg-kbd">
                <b>⌘</b>+<b>Enter</b>
              </span>
            )}
            <div className="fg-actions__spacer" />
            <button className="fg-btn fg-btn--primary fg-btn--sm" onClick={generate} disabled={!input.trim() || busy}>
              Generate flow
            </button>
          </div>
          {error && nodes.length === 0 ? (
            <div className="fg-error" style={{ marginTop: 12 }}>
              <Warn width={15} />
              <div>{error}</div>
            </div>
          ) : null}

          <div className="fg-studio__divider" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fg-toolbtn" onClick={() => store.undo()} disabled={!store.canUndo()}>
              <Undo width={15} /> Undo
            </button>
            <button className="fg-toolbtn" onClick={() => store.redo()} disabled={!store.canRedo()}>
              <Redo width={15} /> Redo
            </button>
            <button className="fg-toolbtn" onClick={addStep} style={{ marginLeft: 'auto' }}>
              <Plus width={15} /> Step
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '12px 0 0' }}>
            {nodes.length} step{nodes.length !== 1 ? 's' : ''} · {state.edges.length} connection
            {state.edges.length !== 1 ? 's' : ''} · store v{store.getVersion()}
          </p>
        </aside>

        <div className="fg-canvas" ref={canvasRef}>
          {nodes.length === 0 ? (
            <div className="fg-canvas__empty">
              Describe an automation on the left — the AI&apos;s connected steps land here.
            </div>
          ) : null}

          <svg className="fg-wedges">
            <defs>
              <marker id="fg-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--border-strong)" />
              </marker>
            </defs>
            {state.edges.map((e, i) => {
              const s = state.nodes[e.from];
              const t = state.nodes[e.to];
              if (!s || !t) return null;
              const g = edgeGeom(s, t);
              return (
                <g className="fg-wedge-group" key={i} onClick={() => removeEdge(i)}>
                  <line className="fg-wedge-hit" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
                  <line className="fg-wedge" markerEnd="url(#fg-arrow)" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
                </g>
              );
            })}
            {connectFrom && cursor && state.nodes[connectFrom]
              ? (() => {
                  const c = center(state.nodes[connectFrom]!);
                  return <line className="fg-wtemp" x1={c.x} y1={c.y} x2={cursor.x} y2={cursor.y} />;
                })()
              : null}
          </svg>

          {nodes.map((n) => (
            <div
              key={n.id}
              className={`fg-wnode ${dragId === n.id ? 'fg-wnode--dragging' : ''}`}
              style={{ left: n.x, top: n.y, borderLeftColor: KIND_COLOR[n.kind] }}
              onMouseDown={(e) => {
                e.stopPropagation();
                startDrag(e, n);
              }}
              onMouseUp={() => onNodeMouseUp(n.id)}
            >
              <button
                className="fg-wnode__del"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => removeNode(n.id)}
                aria-label="Delete step"
              >
                <X width={12} />
              </button>
              <div
                className="fg-wnode__kind"
                style={{ color: KIND_COLOR[n.kind], cursor: 'pointer' }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => cycleKind(n.id)}
                title="Click to change type"
              >
                {n.kind}
              </div>
              <input
                className="fg-wnode__label"
                value={n.label}
                onChange={(e) => rename(n.id, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div
                className="fg-wnode__handle"
                title="Drag to another step to connect"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setConnectFrom(n.id);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="fg-canvas-note">
        Generate a flow, drag a step, wire two with the bottom handle, then Undo — it reverts the last
        action, whichever it was. AI and manual edits, one store.
      </div>
    </main>
  );
}
