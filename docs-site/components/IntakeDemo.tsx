// IntakeDemo — config-driven "narrative → confirmed structured record" flow.
// Paste/describe → AI extracts a structured record → review/correct every field
// in a store-backed form (edits undoable) → submit. One component; each real
// use case (resume, loan, …) is a spec. Flowgent's actual sweet spot.

'use client';

import { useEffect, useState } from 'react';
import { createStore, type Store } from '@flowgent/core/store';
import { createAIClient } from '@flowgent/core/ai';
import { useStore } from '@flowgent/core/react';
import { KEY_STORAGE } from '../lib/demos';
import {
  intakeSpecBySlug,
  type FieldDef,
  type IntakeData,
  type IntakeSpec,
  type SectionDef,
} from '../lib/intake';
import { Back, Check, Plus, Redo, Undo, Warn, X } from './icons';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function parseIntake(raw: string, spec: IntakeSpec): IntakeData {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1]!.trim();
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(s) as Record<string, unknown>;
  } catch {
    o = {};
  }
  const fields: Record<string, string> = {};
  const lists: Record<string, Array<Record<string, string>>> = {};
  for (const sec of spec.sections) {
    if (sec.kind === 'fields') {
      for (const f of sec.fields) fields[f.key] = str(o[f.key]);
    } else {
      const arr = Array.isArray(o[sec.key]) ? (o[sec.key] as unknown[]) : [];
      lists[sec.key] = arr.map((item) => {
        const r = (item ?? {}) as Record<string, unknown>;
        return Object.fromEntries(sec.fields.map((f) => [f.key, str(r[f.key])]));
      });
    }
  }
  return { fields, lists };
}

function blankItem(sec: SectionDef): Record<string, string> {
  return Object.fromEntries(sec.fields.map((f) => [f.key, '']));
}

async function extract(spec: IntakeSpec, input: string, mock: boolean): Promise<IntakeData> {
  if (mock) {
    await new Promise((r) => setTimeout(r, 500));
    return spec.sample;
  }
  const key = typeof window !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  if (!key) throw { kind: 'ai-invalid-key' };
  const client = createAIClient({ apiKey: key });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: spec.aiSystem,
    messages: [{ role: 'user', content: input }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  return parseIntake(block && block.type === 'text' ? block.text : '{}', spec);
}

export default function IntakeDemo({ slug }: { slug: string }) {
  const spec = intakeSpecBySlug(slug);
  const [mock] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock'),
  );
  const [store] = useState<Store<{ data: IntakeData | null }>>(() =>
    createStore<{ data: IntakeData | null }>({ initial: { data: null } }),
  );
  const { data } = useStore(store);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hasKey, setHasKey] = useState(true);

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

  async function autofill() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await extract(spec, input.trim(), mock);
      store.mutate((d) => {
        d.data = extracted;
      });
    } catch (e) {
      const kind = (e as { kind?: string })?.kind;
      setError(
        kind === 'ai-invalid-key'
          ? 'No API key — add one on the home page, or append ?mock=1 to preview.'
          : 'Could not reach Claude. Try again, or use ?mock=1.',
      );
    } finally {
      setBusy(false);
    }
  }

  const setField = (k: string, v: string) =>
    store.mutate((d) => void (d.data && (d.data.fields[k] = v)));
  const setItem = (secKey: string, i: number, fk: string, v: string) =>
    store.mutate((d) => {
      const it = d.data?.lists[secKey]?.[i];
      if (it) it[fk] = v;
    });
  const addItem = (sec: SectionDef) =>
    store.mutate((d) => void d.data?.lists[sec.key]?.push(blankItem(sec)));
  const removeItem = (secKey: string, i: number) =>
    store.mutate((d) => void d.data?.lists[secKey]?.splice(i, 1));
  const reset = () => {
    store.mutate((d) => void (d.data = null));
    setInput('');
    setSubmitted(false);
  };

  return (
    <main className="fg-page" style={{ maxWidth: 760 }}>
      <div className="fg-topbar">
        <a className="fg-back" href="/">
          <Back width={15} /> All demos
        </a>
        <div className="fg-topbar__spacer" />
        <span className="fg-pill">
          <span className="fg-pill__dot" /> {mock ? 'Preview · no key' : 'AI intake · review before submit'}
        </span>
      </div>

      <div className="fg-hero" style={{ marginBottom: 18 }}>
        <p className="fg-plan__eyebrow">{spec.eyebrow}</p>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '6px 0 6px', fontWeight: 700 }}>
          {spec.name}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 680, margin: 0, lineHeight: 1.5 }}>
          {spec.tagline}
        </p>
      </div>

      {submitted ? (
        <div className="fg-paste fg-done" style={{ textAlign: 'center' }}>
          <div className="fg-done__check">
            <Check width={26} />
          </div>
          <h2 className="fg-done__title">Submitted</h2>
          <p className="fg-done__sub">{data ? spec.doneSummary(data) : ''} — all confirmed by you.</p>
          <button className="fg-btn fg-btn--ghost" onClick={reset}>
            Start over
          </button>
        </div>
      ) : data ? (
        <div className="fg-form">
          <div className="fg-aifill">
            <Warn width={14} /> AI-filled from what you wrote — review and correct before submitting.
          </div>

          {spec.sections.map((sec) =>
            sec.kind === 'fields' ? (
              <div className="fg-card-section" key={sec.key}>
                <div className="fg-section__head">
                  <h3 className="fg-section__title">{sec.title}</h3>
                </div>
                <div className="fg-grid2">
                  {sec.fields.map((f) => (
                    <Field
                      key={f.key}
                      def={f}
                      value={data.fields[f.key] ?? ''}
                      onChange={(v) => setField(f.key, v)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="fg-card-section" key={sec.key}>
                <div className="fg-section__head">
                  <h3 className="fg-section__title">{sec.title}</h3>
                </div>
                {(data.lists[sec.key] ?? []).map((item, i) => (
                  <div className="fg-li" key={i}>
                    <button className="fg-li__remove" onClick={() => removeItem(sec.key, i)} aria-label="Remove">
                      <X width={14} />
                    </button>
                    <div className="fg-grid2">
                      {sec.fields.map((f) => (
                        <Field
                          key={f.key}
                          def={f}
                          value={item[f.key] ?? ''}
                          onChange={(v) => setItem(sec.key, i, f.key, v)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <button className="fg-addrow" onClick={() => addItem(sec)}>
                  <Plus width={14} /> {sec.addLabel ?? 'Add'}
                </button>
              </div>
            ),
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button className="fg-btn fg-btn--primary" onClick={() => setSubmitted(true)}>
              <Check width={15} /> {spec.submitLabel}
            </button>
            <button className="fg-toolbtn" onClick={() => store.undo()} disabled={!store.canUndo()}>
              <Undo width={15} /> Undo
            </button>
            <button className="fg-toolbtn" onClick={() => store.redo()} disabled={!store.canRedo()}>
              <Redo width={15} /> Redo
            </button>
            <div style={{ flex: 1 }} />
            <button className="fg-btn fg-btn--subtle fg-btn--sm" onClick={reset}>
              Start over
            </button>
          </div>
        </div>
      ) : (
        <div className="fg-paste">
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{spec.inputTitle}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 14px' }}>{spec.inputHint}</p>
          {!hasKey && !mock ? (
            <div className="fg-keywarn" style={{ marginBottom: 14 }}>
              <Warn width={16} />
              <div>
                No API key. <a href="/">Add one</a>, or append <code>?mock=1</code> to preview with a
                sample.
              </div>
            </div>
          ) : null}
          <textarea
            className="fg-input"
            style={{ minHeight: 190 }}
            value={input}
            placeholder={spec.placeholder}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <div className="fg-actions" style={{ marginTop: 14 }}>
            {busy ? (
              <div className="fg-thinking">
                <span className="fg-spinner" /> Reading what you wrote…
              </div>
            ) : (
              <span className="fg-kbd">{mock ? 'Preview uses a sample' : 'AI fills the form'}</span>
            )}
            <div className="fg-actions__spacer" />
            <button className="fg-btn fg-btn--primary" onClick={autofill} disabled={!input.trim() || busy}>
              Auto-fill
            </button>
          </div>
          {error ? (
            <div className="fg-error" style={{ marginTop: 12 }}>
              <Warn width={15} />
              <div>{error}</div>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}

function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="fg-field" style={def.full ? { gridColumn: '1 / -1' } : undefined}>
      <span className="fg-field__label">{def.label}</span>
      {def.type === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
