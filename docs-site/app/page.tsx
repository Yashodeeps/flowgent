'use client';

import { useEffect, useState } from 'react';
import { DEMOS, KEY_STORAGE } from '../lib/demos';
import { FileText, Grid, Layers, Zap } from '../components/icons';

const ICONS: Record<string, (p: { width?: number }) => JSX.Element> = {
  onboarding: Layers,
  application: FileText,
  automation: Zap,
};

export default function Landing() {
  const [apiKey, setApiKey] = useState('');
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    setStored(localStorage.getItem(KEY_STORAGE));
  }, []);

  function saveKey() {
    localStorage.setItem(KEY_STORAGE, apiKey);
    setStored(apiKey);
    setApiKey('');
  }
  function clearKey() {
    localStorage.removeItem(KEY_STORAGE);
    setStored(null);
  }

  const hasKey = Boolean(stored);

  return (
    <main className="fg-page" style={{ maxWidth: 960 }}>
      <div className="fg-hero">
        <p className="fg-plan__eyebrow">flowgent · v0.0.1</p>
        <h1 style={{ fontSize: 42, letterSpacing: '-0.025em', margin: '8px 0 12px', fontWeight: 700 }}>
          AI Wizard UX patterns
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-2)', maxWidth: 660, lineHeight: 1.5, margin: 0 }}>
          The missing layer between rigid forms and freeform chat. Five UX contracts every AI-driven
          multi-step flow needs — one small TypeScript library, three live demos below.
        </p>
      </div>

      <section className="fg-keycard">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>API key</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
            Bring your own Anthropic key — stored in your browser, sent only to api.anthropic.com.
            Prefer not to paste it? Set <code className="fg-code">ANTHROPIC_API_KEY</code> in{' '}
            <code className="fg-code">docs-site/.env.local</code>, or try any demo with{' '}
            <code className="fg-code">?mock=1</code> for a no-key preview.
          </p>
        </div>
        {hasKey ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="fg-pill fg-pill--ok">
              <span className="fg-pill__dot" /> Key set · {stored?.slice(0, 7)}…
            </span>
            <button className="fg-btn fg-btn--ghost fg-btn--sm" onClick={clearKey}>
              Clear
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              className="fg-keyinput"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && apiKey) saveKey();
              }}
            />
            <button className="fg-btn fg-btn--primary fg-btn--sm" onClick={saveKey} disabled={!apiKey}>
              Save
            </button>
          </div>
        )}
      </section>

      <h2 style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '34px 0 14px' }}>
        Three reference demos
      </h2>
      <div className="fg-grid3">
        {DEMOS.map((d) => {
          const Icon = ICONS[d.slug] ?? Layers;
          return (
            <a key={d.slug} href={`/${d.slug}`} className="fg-card">
              <div className="fg-card__icon">
                <Icon width={20} />
              </div>
              <h3 style={{ fontSize: 16.5, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{d.name}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                {d.blurb}
              </p>
              <div className="fg-card__flow">{d.flow}</div>
            </a>
          );
        })}
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '34px 0 14px' }}>
        Same engine, no wizard
      </h2>
      <a href="/canvas" className="fg-card" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <div className="fg-card__icon" style={{ marginBottom: 0, flex: 'none' }}>
          <Grid width={20} />
        </div>
        <div>
          <h3 style={{ fontSize: 16.5, margin: '0 0 6px', letterSpacing: '-0.01em' }}>Headless store canvas</h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            A draggable canvas with undo/redo and live cross-tab sync — the same engine, driven
            directly via <code className="fg-code">createStore</code> from{' '}
            <code className="fg-code">@flowgent/core/store</code>. No wizard, no AI.
          </p>
        </div>
      </a>
    </main>
  );
}
