// The split-cockpit demo shell, driven directly against the @flowgent/core
// Bridge (useBridge for state, bridge.* for actions). Reused by all three demos.

'use client';

import { useEffect, useState } from 'react';
import { createBridge, useBridge } from '@flowgent/core';
import type { Bridge, BridgeState, WizardError } from '@flowgent/core';
import { DEMOS, demoBySlug, KEY_STORAGE, makeGenerator, type DemoSpec } from '../lib/demos';
import { Arrow, Back, Check, Grip, Plus, Refresh, Warn, X } from './icons';

type KeyState = 'checking' | 'present' | 'missing';

function entityLabel(data: unknown): string {
  const label = (data as { label?: unknown })?.label;
  return typeof label === 'string' && label.trim() ? label : '(unnamed)';
}

export default function WizardDemo({ slug, mock = false }: { slug: string; mock?: boolean }) {
  const spec = demoBySlug(slug) ?? DEMOS[0]!;
  const [bridge] = useState<Bridge>(() =>
    createBridge(spec.config, { apiKey: '', aiGenerate: makeGenerator(spec, mock) }),
  );
  const state = useBridge(bridge);
  const [keyState, setKeyState] = useState<KeyState>('checking');

  useEffect(() => {
    bridge.start();
    if (mock || localStorage.getItem(KEY_STORAGE)) {
      setKeyState('present');
      return;
    }
    fetch('/api/anthropic')
      .then((r) => r.json())
      .then((d) => setKeyState(d.hasServerKey ? 'present' : 'missing'))
      .catch(() => setKeyState('missing'));
  }, [bridge, mock]);

  const entities = Object.values(state.snapshot.entities);
  const done = !state.currentQuestion && !state.pendingProposal && entities.length > 0;
  const curIdx = spec.steps.findIndex((s) => s.id === state.currentQuestion?.stepId);
  const activeIndex = done ? spec.steps.length : curIdx >= 0 ? curIdx : 0;

  return (
    <main className="fg-page">
      <Topbar keyState={keyState} mock={mock} />
      <div className="fg-cockpit">
        <PlanPanel spec={spec} state={state} bridge={bridge} activeIndex={activeIndex} done={done} />
        <section className="fg-step">
          {keyState === 'missing' && !mock ? <KeyWarning /> : null}
          {state.pendingProposal ? (
            <ConfirmView spec={spec} state={state} bridge={bridge} />
          ) : done ? (
            <DoneView spec={spec} entityCount={entities.length} />
          ) : (
            <QuestionView spec={spec} state={state} bridge={bridge} stepIndex={activeIndex} />
          )}
          {state.lastError ? <ErrorBanner error={state.lastError} /> : null}
        </section>
      </div>
    </main>
  );
}

function Topbar({ keyState, mock }: { keyState: KeyState; mock: boolean }) {
  return (
    <div className="fg-topbar">
      <a className="fg-back" href="/">
        <Back width={15} /> All demos
      </a>
      <div className="fg-topbar__spacer" />
      {mock ? (
        <span className="fg-pill">
          <span className="fg-pill__dot" /> Preview mode · no key
        </span>
      ) : keyState === 'present' ? (
        <span className="fg-pill fg-pill--ok">
          <span className="fg-pill__dot" /> Live · Claude
        </span>
      ) : keyState === 'missing' ? (
        <span className="fg-pill fg-pill--warn">
          <span className="fg-pill__dot" /> No API key
        </span>
      ) : (
        <span className="fg-pill">
          <span className="fg-pill__dot" /> Checking key…
        </span>
      )}
    </div>
  );
}

function PlanPanel({
  spec,
  state,
  bridge,
  activeIndex,
  done,
}: {
  spec: DemoSpec;
  state: BridgeState;
  bridge: Bridge;
  activeIndex: number;
  done: boolean;
}) {
  const entities = Object.values(state.snapshot.entities);
  return (
    <aside className="fg-plan">
      <div className="fg-plan__eyebrow">flowgent demo</div>
      <h1 className="fg-plan__title">{spec.name}</h1>
      <p className="fg-plan__sub">{spec.tagline}</p>

      <ol className="fg-steps">
        {spec.steps.map((s, i) => {
          const status = done || i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'upcoming';
          return (
            <li key={s.id} className={`fg-steps__item fg-steps__item--${status}`}>
              <span className="fg-steps__marker">{status === 'done' ? <Check width={11} /> : null}</span>
              {s.groupLabel}
            </li>
          );
        })}
      </ol>

      <div className="fg-plan__heading">Your plan</div>
      {entities.length === 0 ? (
        <div className="fg-plan__empty">
          Nothing yet. Answer the first question and accept the AI&apos;s proposal to start building.
        </div>
      ) : (
        spec.steps.map((s) => {
          const items = entities.filter((e) => e.kind === s.emitsKind);
          if (!items.length) return null;
          return (
            <div className="fg-group" key={s.id}>
              <div className="fg-group__label">{s.groupLabel}</div>
              <ul className="fg-entities">
                {items.map((e) => (
                  <li className="fg-entity" key={e.id}>
                    <span className="fg-entity__dot" />
                    <span className="fg-entity__label">{entityLabel(e.data)}</span>
                    <button
                      className="fg-entity__del"
                      onClick={() => void bridge.deleteItem(e.id)}
                      aria-label="Remove"
                    >
                      <X width={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}

      {state.recentSkip ? (
        <div className="fg-toast">
          <Warn width={14} /> Skipped a question — {state.recentSkip.reason}
        </div>
      ) : null}
    </aside>
  );
}

function QuestionView({
  spec,
  state,
  bridge,
  stepIndex,
}: {
  spec: DemoSpec;
  state: BridgeState;
  bridge: Bridge;
  stepIndex: number;
}) {
  const [text, setText] = useState('');
  const step = spec.steps[stepIndex] ?? spec.steps[0]!;
  const thinking = state.aiStatus !== 'idle';
  const submit = () => {
    const v = text.trim();
    if (v && !thinking) void bridge.submit(v);
  };
  return (
    <div>
      <div className="fg-step__eyebrow">
        Step {stepIndex + 1} of {spec.steps.length} · {step.groupLabel}
      </div>
      <h2 className="fg-q__prompt">{step.question}</h2>
      <p className="fg-q__hint">{step.hint}</p>
      <textarea
        className="fg-input"
        value={text}
        placeholder={step.placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
        }}
        disabled={thinking}
        autoFocus
      />
      <div className="fg-actions">
        {thinking ? (
          <div className={`fg-thinking ${state.aiStatus === 'retrying' ? 'fg-thinking--retry' : ''}`}>
            <span className="fg-spinner" />
            {state.aiStatus === 'retrying' ? 'Rate limited — retrying…' : 'Claude is reading your answer…'}
          </div>
        ) : (
          <span className="fg-kbd">
            <b>⌘</b>/<b>Ctrl</b> + <b>Enter</b> to propose
          </span>
        )}
        <div className="fg-actions__spacer" />
        <button className="fg-btn fg-btn--primary" onClick={submit} disabled={!text.trim() || thinking}>
          Propose <Arrow width={15} />
        </button>
      </div>
    </div>
  );
}

function ConfirmView({
  spec,
  state,
  bridge,
}: {
  spec: DemoSpec;
  state: BridgeState;
  bridge: Bridge;
}) {
  const p = state.pendingProposal!;
  const busy = state.aiStatus !== 'idle';
  const step = spec.steps.find((s) => s.id === state.currentQuestion?.stepId);
  const label = (step?.groupLabel ?? 'items').toLowerCase();
  const hasEmpty = p.items.some((it) => !it.text.trim());

  return (
    <div className={`fg-confirm ${busy ? 'fg-confirm--busy' : ''}`}>
      <div className="fg-confirm__head">
        <h2 className="fg-confirm__title">Review the proposed {label}</h2>
        <span className="fg-confirm__count">
          {p.items.length} item{p.items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="fg-confirm__sub">
        Claude turned your answer into these. Edit any text, remove what&apos;s wrong, or add your
        own — nothing is saved until you accept.
      </p>

      <ul className="fg-items">
        {p.items.map((item) => (
          <li className="fg-item" key={item.id}>
            <span className="fg-item__grip">
              <Grip width={15} />
            </span>
            <input
              className="fg-item__input"
              value={item.text}
              placeholder="Describe this item…"
              onChange={(e) => bridge.editItem(item.id, e.target.value)}
            />
            <button
              className="fg-item__del"
              onClick={() => void bridge.deleteItem(item.id)}
              aria-label="Remove"
            >
              <X width={15} />
            </button>
          </li>
        ))}
      </ul>

      <button className="fg-confirm__add" onClick={() => bridge.addProposalItem('')}>
        <Plus width={15} /> Add an item
      </button>

      <div className="fg-confirm__actions">
        <button
          className="fg-btn fg-btn--primary"
          onClick={() => void bridge.acceptBatch(p)}
          disabled={busy || p.items.length === 0 || hasEmpty}
        >
          <Check width={15} /> Accept{p.items.length ? ` all ${p.items.length}` : ''}
        </button>
        <button
          className="fg-btn fg-btn--ghost fg-btn--sm"
          onClick={() => void bridge.regenerateProposal()}
          disabled={busy}
        >
          <Refresh width={14} /> Regenerate
        </button>
        <div className="fg-actions__spacer" />
        <button className="fg-btn fg-btn--subtle fg-btn--sm" onClick={() => bridge.rejectBatch()}>
          Discard
        </button>
      </div>
    </div>
  );
}

function DoneView({ spec, entityCount }: { spec: DemoSpec; entityCount: number }) {
  return (
    <div className="fg-done">
      <div className="fg-done__check">
        <Check width={26} />
      </div>
      <h2 className="fg-done__title">{spec.name} complete</h2>
      <p className="fg-done__sub">
        {entityCount} item{entityCount !== 1 ? 's' : ''} created across {spec.steps.length} steps —
        every one confirmed by you, nothing auto-applied.
      </p>
      <button className="fg-btn fg-btn--ghost" onClick={() => window.location.reload()}>
        Start over
      </button>
    </div>
  );
}

function KeyWarning() {
  return (
    <div className="fg-keywarn">
      <Warn width={16} />
      <div>
        No Anthropic key found. <a href="/">Add one on the home page</a>, or set{' '}
        <code>ANTHROPIC_API_KEY</code> in <code>docs-site/.env.local</code>. Or append{' '}
        <code>?mock=1</code> to the URL to preview the flow without a key.
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: WizardError }) {
  const msg =
    error.kind === 'ai-invalid-key'
      ? 'No valid API key — set one to run this step (or use ?mock=1).'
      : error.kind === 'ai-rate-limit'
        ? 'Rate limited by the API. Give it a moment and try again.'
        : error.kind === 'ai-network'
          ? 'Network hiccup talking to Claude. Try again.'
          : error.kind === 'ai-malformed-response'
            ? 'Claude returned something unexpected. Try Regenerate.'
            : 'Something went off-script. Try again.';
  return (
    <div className="fg-error">
      <Warn width={15} />
      <div>{msg}</div>
    </div>
  );
}
