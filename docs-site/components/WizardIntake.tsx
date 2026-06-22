// WizardIntake — the moat. A guided, multi-step wizard: one focused question at
// a time → the user answers naturally → AI structures THAT step's answer into
// fields the user confirms → the confirmed record accumulates in a @flowgent/core
// store (maintained state, visible the whole way, undoable). Not one-shot.

'use client';

import { useEffect, useState } from 'react';
import { createStore, type Store } from '@flowgent/core/store';
import { createAIClient } from '@flowgent/core/ai';
import { useStore } from '@flowgent/core/react';
import { KEY_STORAGE } from '../lib/demos';
import { wizardSpecBySlug, type WField, type WStep } from '../lib/wizards';
import { Back, Check, Plus, Redo, Undo, Warn, X } from './icons';

type Phase = 'ask' | 'confirm' | 'review' | 'done';
interface Record_ {
  fields: { [k: string]: string };
  lists: { [k: string]: Array<{ [k: string]: string }> };
}
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function extractStep(step: WStep, answer: string, mock: boolean) {
  if (mock) {
    await new Promise((r) => setTimeout(r, 450));
    return step.sample;
  }
  const key = typeof window !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  if (!key) throw { kind: 'ai-invalid-key' };
  const client = createAIClient({ apiKey: key });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: step.aiSystem,
    messages: [{ role: 'user', content: answer }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  let raw = (block && block.type === 'text' ? block.text : '{}').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1]!.trim();
  let o: { [k: string]: unknown } = {};
  try {
    o = JSON.parse(raw);
  } catch {
    o = {};
  }
  if (step.kind === 'list') {
    const arr = Array.isArray(o.items) ? (o.items as unknown[]) : ((Object.values(o).find(Array.isArray) as unknown[]) ?? []);
    return arr.map((it) => {
      const r = (it ?? {}) as { [k: string]: unknown };
      return Object.fromEntries(step.fields.map((f) => [f.key, str(r[f.key])]));
    });
  }
  return Object.fromEntries(step.fields.map((f) => [f.key, str(o[f.key])]));
}

export default function WizardIntake({ slug, mock = false }: { slug: string; mock?: boolean }) {
  const spec = wizardSpecBySlug(slug);
  const [store] = useState<Store<{ record: Record_ }>>(() =>
    createStore<{ record: Record_ }>({ initial: { record: { fields: {}, lists: {} } } }),
  );
  const { record } = useStore(store);

  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [answer, setAnswer] = useState('');
  const [draftFields, setDraftFields] = useState<{ [k: string]: string }>({});
  const [draftList, setDraftList] = useState<Array<{ [k: string]: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);

  const step = spec.steps[stepIndex] ?? spec.steps[0]!;
  const lastStep = stepIndex === spec.steps.length - 1;

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

  async function submitAnswer() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await extractStep(step, answer.trim(), mock);
      if (step.kind === 'list') setDraftList(extracted as Array<{ [k: string]: string }>);
      else setDraftFields(extracted as { [k: string]: string });
      setPhase('confirm');
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

  function confirmStep() {
    store.mutate((d) => {
      if (step.kind === 'list') d.record.lists[step.key] = draftList.filter((it) => Object.values(it).some(Boolean));
      else for (const [k, v] of Object.entries(draftFields)) d.record.fields[k] = v;
    });
    setAnswer('');
    setDraftFields({});
    setDraftList([]);
    if (lastStep) setPhase('review');
    else {
      setStepIndex(stepIndex + 1);
      setPhase('ask');
    }
  }
  function backAStep() {
    if (stepIndex === 0) return;
    setStepIndex(stepIndex - 1);
    setPhase('ask');
    setAnswer('');
  }

  // confirm-step draft editors
  const setDraftField = (k: string, v: string) => setDraftFields((p) => ({ ...p, [k]: v }));
  const setDraftItem = (i: number, k: string, v: string) =>
    setDraftList((p) => p.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const addDraftItem = () => setDraftList((p) => [...p, Object.fromEntries(step.fields.map((f) => [f.key, '']))]);
  const removeDraftItem = (i: number) => setDraftList((p) => p.filter((_, j) => j !== i));

  // review editors (committed record, undoable)
  const setRecField = (k: string, v: string) => store.mutate((d) => void (d.record.fields[k] = v));
  const setRecItem = (sk: string, i: number, k: string, v: string) =>
    store.mutate((d) => {
      const it = d.record.lists[sk]?.[i];
      if (it) it[k] = v;
    });

  const confirmedSteps = spec.steps.filter((s, i) =>
    i < stepIndex || (i === stepIndex && (phase === 'review' || phase === 'done')) || (lastStep && phase !== 'ask' && phase !== 'confirm'),
  );

  return (
    <main className="fg-page">
      <div className="fg-topbar">
        <a className="fg-back" href="/">
          <Back width={15} /> All demos
        </a>
        <div className="fg-topbar__spacer" />
        <span className="fg-pill">
          <span className="fg-pill__dot" /> {mock ? 'Preview · no key' : 'Guided wizard · state builds step by step'}
        </span>
      </div>

      <div className="fg-cockpit">
        {/* LEFT: progress + the application accumulating */}
        <aside className="fg-plan">
          <div className="fg-plan__eyebrow">{spec.eyebrow.split('·').pop()?.trim()}</div>
          <h1 className="fg-plan__title">{spec.name}</h1>
          <p className="fg-plan__sub">{spec.tagline}</p>

          <ol className="fg-steps">
            {spec.steps.map((s, i) => {
              const status =
                phase === 'done' || phase === 'review' || i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming';
              return (
                <li key={s.key} className={`fg-steps__item fg-steps__item--${status}`}>
                  <span className="fg-steps__marker">{status === 'done' ? <Check width={11} /> : null}</span>
                  {s.groupLabel}
                </li>
              );
            })}
          </ol>

          <div className="fg-plan__heading">Your application</div>
          {confirmedSteps.length === 0 ? (
            <div className="fg-plan__empty">Answer each question; confirmed details land here and stay.</div>
          ) : (
            spec.steps.map((s) => {
              const isConfirmed = confirmedSteps.includes(s);
              if (!isConfirmed) return null;
              if (s.kind === 'list') {
                const items = record.lists[s.key] ?? [];
                if (!items.length) return null;
                return (
                  <div className="fg-group" key={s.key}>
                    <div className="fg-group__label">{s.groupLabel}</div>
                    <ul className="fg-entities">
                      {items.map((it, i) => (
                        <li className="fg-entity" key={i}>
                          <span className="fg-entity__dot" />
                          <span className="fg-entity__label">
                            {s.fields.map((f) => it[f.key]).filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              const vals = s.fields.filter((f) => record.fields[f.key]);
              if (!vals.length) return null;
              return (
                <div className="fg-group" key={s.key}>
                  <div className="fg-group__label">{s.groupLabel}</div>
                  <div className="fg-kv">
                    {vals.map((f) => (
                      <div className="fg-kv__row" key={f.key}>
                        <span className="fg-kv__k">{f.label}</span>
                        <span className="fg-kv__v">{record.fields[f.key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {(phase === 'review' || stepIndex > 0) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="fg-toolbtn fg-btn--sm" onClick={() => store.undo()} disabled={!store.canUndo()}>
                <Undo width={14} /> Undo
              </button>
              <button className="fg-toolbtn fg-btn--sm" onClick={() => store.redo()} disabled={!store.canRedo()}>
                <Redo width={14} /> Redo
              </button>
            </div>
          )}
        </aside>

        {/* RIGHT: the current step */}
        <section className="fg-step">
          {phase === 'done' ? (
            <div className="fg-done" style={{ textAlign: 'center' }}>
              <div className="fg-done__check">
                <Check width={26} />
              </div>
              <h2 className="fg-done__title">{spec.doneTitle}</h2>
              <p className="fg-done__sub">
                {record.fields.fullName || 'Applicant'} · answered {spec.steps.length} steps — every detail
                confirmed by you.
              </p>
              <button className="fg-btn fg-btn--ghost" onClick={() => window.location.reload()}>
                Start over
              </button>
            </div>
          ) : phase === 'review' ? (
            <div>
              <div className="fg-step__eyebrow">Review</div>
              <h2 className="fg-q__prompt">Review your application</h2>
              <p className="fg-q__hint">Edit anything before you submit. Changes undo.</p>
              <div className="fg-form" style={{ marginTop: 16 }}>
                {spec.steps.map((s) =>
                  s.kind === 'list' ? (
                    <div className="fg-card-section" key={s.key}>
                      <div className="fg-section__head">
                        <h3 className="fg-section__title">{s.groupLabel}</h3>
                      </div>
                      {(record.lists[s.key] ?? []).map((it, i) => (
                        <div className="fg-li" key={i}>
                          <div className="fg-grid2">
                            {s.fields.map((f) => (
                              <Field key={f.key} def={f} value={it[f.key] ?? ''} onChange={(v) => setRecItem(s.key, i, f.key, v)} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fg-card-section" key={s.key}>
                      <div className="fg-section__head">
                        <h3 className="fg-section__title">{s.groupLabel}</h3>
                      </div>
                      <div className="fg-grid2">
                        {s.fields.map((f) => (
                          <Field key={f.key} def={f} value={record.fields[f.key] ?? ''} onChange={(v) => setRecField(f.key, v)} />
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="fg-btn fg-btn--primary" onClick={() => setPhase('done')}>
                  <Check width={15} /> {spec.submitLabel}
                </button>
              </div>
            </div>
          ) : phase === 'confirm' ? (
            <div>
              <div className="fg-step__eyebrow">
                Step {stepIndex + 1} of {spec.steps.length} · {step.groupLabel}
              </div>
              <h2 className="fg-confirm__title" style={{ margin: '0 0 4px' }}>
                Here&apos;s what I got
              </h2>
              <p className="fg-confirm__sub">Fix anything, then confirm to add it to your application.</p>
              {step.kind === 'list' ? (
                <div>
                  <ul className="fg-items">
                    {draftList.map((it, i) => (
                      <li className="fg-li" key={i} style={{ listStyle: 'none' }}>
                        <button className="fg-li__remove" onClick={() => removeDraftItem(i)} aria-label="Remove">
                          <X width={14} />
                        </button>
                        <div className="fg-grid2">
                          {step.fields.map((f) => (
                            <Field key={f.key} def={f} value={it[f.key] ?? ''} onChange={(v) => setDraftItem(i, f.key, v)} />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button className="fg-addrow" onClick={addDraftItem}>
                    <Plus width={14} /> {step.addLabel ?? 'Add'}
                  </button>
                </div>
              ) : (
                <div className="fg-grid2">
                  {step.fields.map((f) => (
                    <Field key={f.key} def={f} value={draftFields[f.key] ?? ''} onChange={(v) => setDraftField(f.key, v)} />
                  ))}
                </div>
              )}
              <div className="fg-confirm__actions" style={{ marginTop: 18, paddingTop: 16 }}>
                <button className="fg-btn fg-btn--primary" onClick={confirmStep}>
                  <Check width={15} /> {lastStep ? 'Confirm & review' : 'Confirm & continue'}
                </button>
                <button className="fg-btn fg-btn--subtle fg-btn--sm" onClick={() => setPhase('ask')}>
                  Back to the question
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="fg-step__eyebrow">
                Step {stepIndex + 1} of {spec.steps.length} · {step.groupLabel}
              </div>
              <h2 className="fg-q__prompt">{step.question}</h2>
              <p className="fg-q__hint">{step.hint}</p>
              {!hasKey && !mock ? (
                <div className="fg-keywarn" style={{ marginBottom: 12 }}>
                  <Warn width={16} />
                  <div>
                    No API key. <a href="/">Add one</a> or append <code>?mock=1</code>.
                  </div>
                </div>
              ) : null}
              <textarea
                className="fg-input"
                value={answer}
                placeholder={step.placeholder}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitAnswer();
                }}
                disabled={busy}
                autoFocus
              />
              <div className="fg-actions" style={{ marginTop: 14 }}>
                {busy ? (
                  <div className="fg-thinking">
                    <span className="fg-spinner" /> Reading your answer…
                  </div>
                ) : (
                  <span className="fg-kbd">
                    <b>⌘</b>+<b>Enter</b>
                  </span>
                )}
                {stepIndex > 0 ? (
                  <button className="fg-btn fg-btn--subtle fg-btn--sm" onClick={backAStep} style={{ marginLeft: 8 }}>
                    Back
                  </button>
                ) : null}
                <div className="fg-actions__spacer" />
                <button className="fg-btn fg-btn--primary" onClick={submitAnswer} disabled={!answer.trim() || busy}>
                  Continue
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
        </section>
      </div>
    </main>
  );
}

function Field({ def, value, onChange }: { def: WField; value: string; onChange: (v: string) => void }) {
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
