// Resume → job application — a real intake use case. Paste a resume; the AI
// auto-fills a structured application; you review/correct every field; submit.
// Flowgent's actual sweet spot: messy input → confirmed structured data.
// Store (Layer 1) holds the form (edits are undoable); createAIClient does the
// extraction; the review-before-submit IS the editable-confirmation pattern.

'use client';

import { useEffect, useState } from 'react';
import { createStore, type Store } from '@flowgent/core/store';
import { createAIClient } from '@flowgent/core/ai';
import { useStore } from '@flowgent/core/react';
import { KEY_STORAGE } from '../../lib/demos';
import { Back, Check, Plus, Redo, Undo, Warn, X } from '../../components/icons';

interface Exp {
  company: string;
  role: string;
  dates: string;
  highlights: string;
}
interface Edu {
  school: string;
  degree: string;
  year: string;
}
interface App {
  name: string;
  email: string;
  phone: string;
  summary: string;
  skills: string;
  experience: Exp[];
  education: Edu[];
}
type FlatKey = 'name' | 'email' | 'phone' | 'summary' | 'skills';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function parseApp(raw: string): App {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1]!.trim();
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(s) as Record<string, unknown>;
  } catch {
    o = {};
  }
  const exp = Array.isArray(o.experience) ? (o.experience as unknown[]) : [];
  const edu = Array.isArray(o.education) ? (o.education as unknown[]) : [];
  return {
    name: str(o.name),
    email: str(o.email),
    phone: str(o.phone),
    summary: str(o.summary),
    skills: Array.isArray(o.skills) ? (o.skills as unknown[]).map(str).join(', ') : str(o.skills),
    experience: exp.map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      return { company: str(r.company), role: str(r.role), dates: str(r.dates), highlights: str(r.highlights) };
    }),
    education: edu.map((e) => {
      const r = (e ?? {}) as Record<string, unknown>;
      return { school: str(r.school), degree: str(r.degree), year: str(r.year) };
    }),
  };
}

const SAMPLE: App = {
  name: 'Jordan Rivera',
  email: 'jordan.rivera@email.com',
  phone: '(415) 555-0148',
  summary:
    'Full-stack engineer with 6 years building customer-facing web apps. Strong in TypeScript and React; led two billing rewrites.',
  skills: 'TypeScript, React, Node.js, PostgreSQL, AWS, GraphQL',
  experience: [
    {
      company: 'Northwind Trading',
      role: 'Senior Software Engineer',
      dates: '2022 – present',
      highlights: 'Led the billing rewrite; cut checkout errors 40% and shaved 300ms off p95 latency.',
    },
    {
      company: 'Acme Cloud',
      role: 'Software Engineer',
      dates: '2019 – 2022',
      highlights: 'Built the customer dashboard used by 30k teams; owned the notifications service.',
    },
  ],
  education: [{ school: 'UC Berkeley', degree: 'B.S. Computer Science', year: '2019' }],
};

const EXTRACT_SYSTEM =
  'You extract a job application from a resume. Return ONLY JSON, no prose and no code fences, matching exactly: ' +
  '{"name":"","email":"","phone":"","summary":"","skills":"comma-separated","experience":[{"company":"","role":"","dates":"","highlights":""}],"education":[{"school":"","degree":"","year":""}]}';

async function extractApp(resume: string, mock: boolean): Promise<App> {
  if (mock) {
    await new Promise((r) => setTimeout(r, 500));
    return SAMPLE;
  }
  const key = typeof window !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  if (!key) throw { kind: 'ai-invalid-key' };
  const client = createAIClient({ apiKey: key });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: resume }],
  });
  const block = msg.content.find((b) => b.type === 'text');
  return parseApp(block && block.type === 'text' ? block.text : '{}');
}

export default function ResumePage() {
  const [mock] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock'),
  );
  const [store] = useState<Store<{ app: App | null }>>(() =>
    createStore<{ app: App | null }>({ initial: { app: null } }),
  );
  const { app } = useStore(store);

  const [resume, setResume] = useState('');
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
    if (!resume.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await extractApp(resume.trim(), mock);
      store.mutate((d) => {
        d.app = extracted;
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

  const setFlat = (k: FlatKey, v: string) => store.mutate((d) => void (d.app && (d.app[k] = v)));
  const setExp = (i: number, k: keyof Exp, v: string) =>
    store.mutate((d) => {
      const e = d.app?.experience[i];
      if (e) e[k] = v;
    });
  const setEdu = (i: number, k: keyof Edu, v: string) =>
    store.mutate((d) => {
      const e = d.app?.education[i];
      if (e) e[k] = v;
    });
  const addExp = () =>
    store.mutate((d) => void d.app?.experience.push({ company: '', role: '', dates: '', highlights: '' }));
  const removeExp = (i: number) => store.mutate((d) => void d.app?.experience.splice(i, 1));
  const addEdu = () => store.mutate((d) => void d.app?.education.push({ school: '', degree: '', year: '' }));
  const removeEdu = (i: number) => store.mutate((d) => void d.app?.education.splice(i, 1));
  const reset = () => {
    store.mutate((d) => void (d.app = null));
    setResume('');
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
        <p className="fg-plan__eyebrow">flowgent demo · job application</p>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '6px 0 6px', fontWeight: 700 }}>
          Resume → application
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 680, margin: 0, lineHeight: 1.5 }}>
          Paste a resume; the AI fills out a structured application. Every field is yours to correct
          before it submits — nothing is auto-accepted. The form lives in a{' '}
          <code className="fg-code">@flowgent/core</code> store, so your edits undo.
        </p>
      </div>

      {submitted ? (
        <div className="fg-paste fg-done" style={{ textAlign: 'center' }}>
          <div className="fg-done__check">
            <Check width={26} />
          </div>
          <h2 className="fg-done__title">Application submitted</h2>
          <p className="fg-done__sub">
            {app?.name || 'Applicant'} · {app?.experience.length ?? 0} roles · {app?.education.length ?? 0}{' '}
            schools — all confirmed by you.
          </p>
          <button className="fg-btn fg-btn--ghost" onClick={reset}>
            Start over
          </button>
        </div>
      ) : app ? (
        <div className="fg-form">
          <div className="fg-aifill">
            <Warn width={14} /> AI-filled from your resume — review and correct before submitting.
          </div>

          <div className="fg-card-section">
            <div className="fg-section__head">
              <h3 className="fg-section__title">Applicant</h3>
            </div>
            <div className="fg-grid2">
              <Field label="Full name" value={app.name} onChange={(v) => setFlat('name', v)} />
              <Field label="Email" value={app.email} onChange={(v) => setFlat('email', v)} />
              <Field label="Phone" value={app.phone} onChange={(v) => setFlat('phone', v)} />
              <Field label="Skills" value={app.skills} onChange={(v) => setFlat('skills', v)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Summary" textarea value={app.summary} onChange={(v) => setFlat('summary', v)} />
            </div>
          </div>

          <div className="fg-card-section">
            <div className="fg-section__head">
              <h3 className="fg-section__title">Experience</h3>
            </div>
            {app.experience.map((e, i) => (
              <div className="fg-li" key={i}>
                <button className="fg-li__remove" onClick={() => removeExp(i)} aria-label="Remove">
                  <X width={14} />
                </button>
                <div className="fg-grid2">
                  <Field label="Company" value={e.company} onChange={(v) => setExp(i, 'company', v)} />
                  <Field label="Role" value={e.role} onChange={(v) => setExp(i, 'role', v)} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Field label="Dates" value={e.dates} onChange={(v) => setExp(i, 'dates', v)} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Field label="Highlights" textarea value={e.highlights} onChange={(v) => setExp(i, 'highlights', v)} />
                </div>
              </div>
            ))}
            <button className="fg-addrow" onClick={addExp}>
              <Plus width={14} /> Add role
            </button>
          </div>

          <div className="fg-card-section">
            <div className="fg-section__head">
              <h3 className="fg-section__title">Education</h3>
            </div>
            {app.education.map((e, i) => (
              <div className="fg-li" key={i}>
                <button className="fg-li__remove" onClick={() => removeEdu(i)} aria-label="Remove">
                  <X width={14} />
                </button>
                <div className="fg-grid2">
                  <Field label="School" value={e.school} onChange={(v) => setEdu(i, 'school', v)} />
                  <Field label="Degree" value={e.degree} onChange={(v) => setEdu(i, 'degree', v)} />
                </div>
                <div style={{ marginTop: 10, maxWidth: 160 }}>
                  <Field label="Year" value={e.year} onChange={(v) => setEdu(i, 'year', v)} />
                </div>
              </div>
            ))}
            <button className="fg-addrow" onClick={addEdu}>
              <Plus width={14} /> Add school
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button className="fg-btn fg-btn--primary" onClick={() => setSubmitted(true)}>
              <Check width={15} /> Submit application
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
          <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>Paste a resume</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 14px' }}>
            Any format — the AI pulls out the structured application.
          </p>
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
            style={{ minHeight: 200 }}
            value={resume}
            placeholder={'Jordan Rivera — jordan@email.com\nSenior Engineer at Northwind (2022–present)…'}
            onChange={(e) => setResume(e.target.value)}
            disabled={busy}
          />
          <div className="fg-actions" style={{ marginTop: 14 }}>
            {busy ? (
              <div className="fg-thinking">
                <span className="fg-spinner" /> Reading the resume…
              </div>
            ) : (
              <span className="fg-kbd">{mock ? 'Preview uses a sample resume' : 'AI fills the application'}</span>
            )}
            <div className="fg-actions__spacer" />
            <button className="fg-btn fg-btn--primary" onClick={autofill} disabled={!resume.trim() || busy}>
              Auto-fill application
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
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="fg-field">
      <span className="fg-field__label">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}
