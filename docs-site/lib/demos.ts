// Shared data layer for the three reference demos. Each demo is a tiny spec;
// the WizardConfig + AI generator are derived from it, so adding a domain is a
// one-object change — the "infinite possibilities" thesis in code.

import { createAIClient, split } from '@flowgent/core/ai';
import { stepId } from '@flowgent/core';
import type { ProposalItem, Question, Snapshot, WizardConfig } from '@flowgent/core';

export const KEY_STORAGE = 'flowgent:anthropic-key';

export interface DemoStep {
  id: string;
  question: string; // shown to the user
  hint: string; // sub-text under the question
  placeholder: string;
  emitsKind: string; // entity kind this step creates
  parentKind?: string; // link new entities under the latest entity of this kind
  groupLabel: string; // plan section header
  aiPrompt: string; // system prompt for ai.split
}

export interface DemoSpec {
  slug: string;
  name: string;
  tagline: string;
  blurb: string; // one-liner for the index card
  flow: string; // "organization → projects → team", for the index card
  steps: DemoStep[];
  config: WizardConfig;
}

function buildConfig(slug: string, steps: DemoStep[]): WizardConfig {
  const grammarSteps: WizardConfig['stepGrammar']['steps'] = {};
  steps.forEach((step, i) => {
    grammarSteps[step.id] = {
      nextStepIds: i < steps.length - 1 ? [stepId(steps[i + 1]!.id)] : [],
      emitsEntityKind: step.emitsKind,
      questionTemplate: step.question,
    };
  });
  return {
    name: slug,
    sessionId: slug,
    stepGrammar: {
      rootStepId: stepId(steps[0]!.id),
      steps: grammarSteps,
      entitySchema: {} as never,
    },
    prompts: {}, // empty → displayed question stays the questionTemplate above
  };
}

function spec(s: Omit<DemoSpec, 'config'>): DemoSpec {
  return { ...s, config: buildConfig(s.slug, s.steps) };
}

export const ONBOARDING = spec({
  slug: 'onboarding',
  name: 'Product onboarding',
  tagline: 'Set up a new account from a plain-language description.',
  blurb: 'A new user describes their org, projects, and team — the AI turns each answer into a confirmable batch.',
  flow: 'organization → projects → team',
  steps: [
    {
      id: 'organization',
      question: "What's your organization called?",
      hint: 'Just the company or team name.',
      placeholder: 'e.g. Northwind Trading',
      emitsKind: 'organization',
      groupLabel: 'Organization',
      aiPrompt: 'The user is naming their organization. Return the single organization name as one item.',
    },
    {
      id: 'projects',
      question: 'What projects or workspaces do you need?',
      hint: 'List as many as you like — they get split into separate projects.',
      placeholder: 'e.g. Website redesign, Mobile app, Q3 marketing',
      emitsKind: 'project',
      parentKind: 'organization',
      groupLabel: 'Projects',
      aiPrompt: 'Extract each distinct project or workspace the user mentioned as its own item.',
    },
    {
      id: 'team',
      question: "Who's on the team?",
      hint: 'Names or emails — one teammate per item.',
      placeholder: 'e.g. Priya, Sam, alex@northwind.co',
      emitsKind: 'teammate',
      parentKind: 'organization',
      groupLabel: 'Team',
      aiPrompt: 'Extract each distinct teammate (name or email) the user mentioned as its own item.',
    },
  ],
});

export const APPLICATION = spec({
  slug: 'application',
  name: 'Application intake',
  tagline: 'Turn a plain-language request into a structured application.',
  blurb: 'Claims, loans, legal cases, patient intake — one shape: applicant, requests, documents.',
  flow: 'applicant → requests → documents',
  steps: [
    {
      id: 'applicant',
      question: "Who's applying?",
      hint: 'Name and a way to reach them.',
      placeholder: 'e.g. Dana Reyes, dana@email.com, 415-555-0134',
      emitsKind: 'applicant',
      groupLabel: 'Applicant',
      aiPrompt:
        "The user is describing the applicant. Return the applicant's name (with contact details if given) as a single item.",
    },
    {
      id: 'requests',
      question: 'What are you requesting or claiming?',
      hint: 'List each one — they get separated into individual entries.',
      placeholder: 'e.g. water damage to kitchen, replacement laptop, 3 days lost wages',
      emitsKind: 'request',
      parentKind: 'applicant',
      groupLabel: 'Requests',
      aiPrompt: 'Extract each distinct claim or request the user mentioned as its own item.',
    },
    {
      id: 'documents',
      question: 'What documents will you attach?',
      hint: 'List the supporting documents.',
      placeholder: 'e.g. photos of the damage, purchase receipt, police report',
      emitsKind: 'document',
      parentKind: 'applicant',
      groupLabel: 'Documents',
      aiPrompt: 'Extract each distinct supporting document the user mentioned as its own item.',
    },
  ],
});

export const AUTOMATION = spec({
  slug: 'automation',
  name: 'Automation builder',
  tagline: 'Describe an automation in plain language and assemble it step by step.',
  blurb: 'Agents, workflows, no-code automations — describe the goal, then build steps and guardrails.',
  flow: 'automation → steps → guardrails',
  steps: [
    {
      id: 'automation',
      question: 'What should this automation do?',
      hint: 'Give it a one-line goal or name.',
      placeholder: 'e.g. When a customer emails support, triage it and draft a reply',
      emitsKind: 'automation',
      groupLabel: 'Automation',
      aiPrompt:
        'The user is describing an automation. Return a single concise automation name or goal as one item.',
    },
    {
      id: 'steps',
      question: 'What steps should it run?',
      hint: 'List the actions in order — they get split into steps.',
      placeholder: 'e.g. classify the email, look up the order, draft a reply, notify the agent',
      emitsKind: 'step',
      parentKind: 'automation',
      groupLabel: 'Steps',
      aiPrompt: 'Extract each distinct action or step the user mentioned as its own item, preserving order.',
    },
    {
      id: 'guardrails',
      question: 'Any guardrails or limits?',
      hint: 'Rules the automation must respect.',
      placeholder: 'e.g. never send without human approval, business hours only, cap at 50/day',
      emitsKind: 'guardrail',
      parentKind: 'automation',
      groupLabel: 'Guardrails',
      aiPrompt: 'Extract each distinct guardrail or limit the user mentioned as its own item.',
    },
  ],
});

export const DEMOS: DemoSpec[] = [ONBOARDING, APPLICATION, AUTOMATION];

export function demoBySlug(slug: string): DemoSpec | undefined {
  return DEMOS.find((d) => d.slug === slug);
}

// --- generators ---

type Splitter = (prompt: string, input: string) => Promise<string[]>;

// Real path: a BYOK key in localStorage calls Anthropic directly (key never
// leaves the browser); otherwise fall back to the server's .env key via the route.
const realSplit: Splitter = async (prompt, input) => {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  if (localKey) {
    return split(createAIClient({ apiKey: localKey }), prompt, input);
  }
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, input }),
  });
  if (res.status === 503) throw { kind: 'ai-invalid-key' };
  if (!res.ok) throw { kind: 'ai-network', cause: `route ${res.status}` };
  const data = (await res.json()) as { items?: unknown };
  if (!Array.isArray(data.items)) throw { kind: 'ai-malformed-response', raw: JSON.stringify(data) };
  return data.items as string[];
};

// Mock path (?mock=1): no key, no network — split the user's own text locally so
// the whole flow is previewable and screenshot-stable.
const mockSplit: Splitter = async (_prompt, input) => {
  const parts = input
    .split(/\n|,|;| and /i)
    .map((p) => p.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out = parts.filter((p) => (seen.has(p.toLowerCase()) ? false : seen.add(p.toLowerCase())));
  return (out.length ? out : [input.trim()]).slice(0, 8);
};

// Shared splitter — used by the wizard generator and the Studio demo.
export function splitText(prompt: string, input: string, mock: boolean): Promise<string[]> {
  return (mock ? mockSplit : realSplit)(prompt, input);
}

export function makeGenerator(s: DemoSpec, mock: boolean) {
  const splitter = mock ? mockSplit : realSplit;
  return async function aiGenerate(
    answer: string,
    snapshot: Snapshot,
    question: Question | null,
  ): Promise<ProposalItem[]> {
    const step = s.steps.find((st) => st.id === question?.stepId);
    const kind = step?.emitsKind ?? 'item';
    const parent = step?.parentKind
      ? Object.values(snapshot.entities).find((e) => e.kind === step.parentKind)?.id
      : undefined;
    const prompt = step?.aiPrompt ?? 'Extract each distinct item the user mentioned as its own item.';
    const parts = await splitter(prompt, answer);
    return parts.map((text) => ({
      id: crypto.randomUUID(),
      text,
      collapsed: false,
      willCreate: parent ? { kind, parent } : { kind },
    }));
  };
}
