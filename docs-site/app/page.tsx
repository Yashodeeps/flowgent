'use client';

import { useEffect, useState } from 'react';
import { KEY_STORAGE } from '../lib/demos';
import { FileText, Flow, Grid, Home, Layers } from '../components/icons';

const CARDS = [
  {
    href: '/onboarding',
    tag: 'Simple — AI wizard',
    title: 'Onboarding',
    blurb: 'Describe what you need in plain sentences. The AI parses your words into a batch of steps, proposes them all at once, and you decide what stays.',
    flow: 'ask → AI splits → confirm → build',
    Icon: Layers,
  },
  {
    href: '/resume',
    tag: 'Real — guided wizard',
    title: 'Job application',
    blurb: 'Paste your experience in one go. The AI reads the paragraph and separates it into individual entries — roles, skills, education — that you confirm one by one.',
    flow: 'ask → AI separates → confirm · state builds',
    Icon: FileText,
  },
  {
    href: '/loan',
    tag: 'Real — guided wizard',
    title: 'Mortgage application',
    blurb: 'One question at a time. The AI structures each answer, you confirm before it moves on. Nothing gets lost — the application assembles itself on screen.',
    flow: 'ask → confirm → next · state builds',
    Icon: Home,
  },
  {
    href: '/workflow',
    tag: 'Dynamic — store + AI + canvas',
    title: 'AI workflow builder',
    blurb: 'Write a sentence about the automation you have in mind. A canvas of connected steps appears. Wire them differently, rename them, delete what doesn\'t fit.',
    flow: 'describe → AI flow → wire/edit',
    Icon: Flow,
  },
  {
    href: '/canvas',
    tag: 'Minimal — store only',
    title: 'Headless canvas',
    blurb: 'No wizard. No AI. Just the store in its simplest form — draggable nodes, an undo stack that doesn\'t forget, and live sync across tabs.',
    flow: 'createStore → mutate → undo',
    Icon: Grid,
  },
];

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
    <main className="fg-page" style={{ maxWidth: 980 }}>
      <div className="fg-hero">
        <p className="fg-plan__eyebrow">flowgent — v0.2.1 — npm</p>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 48,
            letterSpacing: '-0.015em',
            margin: '8px 0 14px',
            fontWeight: 600,
            lineHeight: 1.1,
          }}
        >
          AI Wizard{' '}
          <em style={{ fontWeight: 400, fontStyle: 'italic' }}>UX patterns</em>
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-2)', maxWidth: 640, lineHeight: 1.65, margin: 0 }}>
          Three moving parts — a headless store, an AI that listens, and a React wizard
          that guides. Install once (<code className="fg-code">npm i @flowgent/core</code>),
          then copy the pattern that fits your flow.
        </p>
      </div>

      <section className="fg-keycard">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 4px', fontWeight: 650 }}>API key</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.65 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '44px 0 20px' }}>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <h2
          style={{
            fontSize: 11,
            fontWeight: 650,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Five demos — one engine
        </h2>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      <div className="fg-grid3">
        {CARDS.map(({ href, tag, title, blurb, flow, Icon }) => (
          <a key={href} href={href} className="fg-card">
            <div className="fg-card__icon">
              <Icon width={18} />
            </div>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 650,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--brand)',
                background: 'var(--brand-tint-2)',
                border: '1px solid var(--brand-tint)',
                borderRadius: 5,
                padding: '2px 7px',
              }}
            >
              {tag}
            </span>
            <h3 style={{ fontSize: 16, margin: '10px 0 7px', letterSpacing: '-0.01em', fontWeight: 650 }}>
              {title}
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{blurb}</p>
            <div className="fg-card__flow">{flow}</div>
          </a>
        ))}
      </div>
    </main>
  );
}
