// @flowgent/core AI-assist (Layer 2): optional helpers that turn user input into
// confirmable proposal items (Pattern 2/3) and rewrite/classify text. Wraps the
// AI primitives with retry/backoff + status hooks. AI is strictly optional — the
// Store and a manual wizard work with none of this.

import type Anthropic from '@anthropic-ai/sdk';
import { classify as aiClassify, createAIClient, mapErrorToWizardError, polish as aiPolish, split as aiSplit } from './ai.js';
import type { AIStatus, EntityId, ProposalItem, WizardError } from './types.js';

// Normalize a thrown value to a WizardError. A value that already looks like a
// WizardError (e.g. ai-malformed-response from a Zod failure) is used as-is.
export function toWizardError(raw: unknown): WizardError {
  if (raw && typeof raw === 'object' && 'kind' in raw && typeof (raw as { kind?: unknown }).kind === 'string') {
    return raw as WizardError;
  }
  return mapErrorToWizardError(raw);
}

const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_NETWORK_RETRIES = 1;

export function retryPolicy(err: WizardError, attempt: number): { retry: boolean; delayMs: number } {
  if (err.kind === 'ai-rate-limit') {
    if (attempt >= MAX_RATE_LIMIT_RETRIES) return { retry: false, delayMs: 0 };
    return { retry: true, delayMs: err.retryAfterMs * 2 ** attempt };
  }
  if (err.kind === 'ai-network') {
    if (attempt >= MAX_NETWORK_RETRIES) return { retry: false, delayMs: 0 };
    return { retry: true, delayMs: 200 * 2 ** attempt };
  }
  return { retry: false, delayMs: 0 };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RunOptions {
  onStatus?: (status: AIStatus) => void;
}

// Run an AI operation with the error surface + auto-retry. Status transitions:
// idle → thinking → (retrying)* → idle. Throws a WizardError on terminal failure.
export async function runWithRetry<T>(fn: () => Promise<T>, opts: RunOptions = {}): Promise<T> {
  const onStatus = opts.onStatus ?? (() => {});
  onStatus('thinking');
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await fn();
      onStatus('idle');
      return result;
    } catch (raw) {
      const err = toWizardError(raw);
      const policy = retryPolicy(err, attempt);
      if (!policy.retry) {
        onStatus('idle');
        throw err;
      }
      onStatus('retrying');
      await delay(policy.delayMs);
      attempt += 1;
    }
  }
}

export interface SuggestOptions {
  prompt: string; // system prompt for the split
  kind: string; // entity kind the items will create
  parent?: EntityId; // optional parent for the created entities
}

export interface AIAssist {
  // Pattern 2: split a free-text answer into confirmable items.
  suggest(input: string, opts: SuggestOptions): Promise<ProposalItem[]>;
  // Pattern 3 / standalone: rewrite a single piece of text.
  rewrite(text: string, instruction?: string): Promise<string>;
  // Classify input into one of the given categories.
  classify(input: string, categories: string[], instruction?: string): Promise<string>;
}

export interface AIAssistOptions {
  client?: Anthropic;
  apiKey?: string;
  providerBaseURL?: string;
  onStatus?: (status: AIStatus) => void;
}

export function createAIAssist(opts: AIAssistOptions): AIAssist {
  function client(): Anthropic {
    if (opts.client) return opts.client;
    if (opts.apiKey) return createAIClient({ apiKey: opts.apiKey, providerBaseURL: opts.providerBaseURL });
    throw { kind: 'ai-invalid-key' } as WizardError; // AI optional — surfaces, never crashes
  }
  return {
    async suggest(input, o) {
      const c = client();
      const parts = await runWithRetry(() => aiSplit(c, o.prompt, input), { onStatus: opts.onStatus });
      return parts.map((text) => ({
        id: crypto.randomUUID(),
        text,
        collapsed: false,
        willCreate: o.parent ? { kind: o.kind, parent: o.parent } : { kind: o.kind },
      }));
    },
    async rewrite(text, instruction) {
      const c = client();
      return runWithRetry(() => aiPolish(c, instruction ?? 'Rewrite this text more clearly, preserving meaning.', text), {
        onStatus: opts.onStatus,
      });
    },
    async classify(input, categories, instruction) {
      const c = client();
      return runWithRetry(() => aiClassify(c, instruction ?? 'Classify the input.', input, categories), {
        onStatus: opts.onStatus,
      });
    },
  };
}
