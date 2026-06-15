// AI primitives. Day 1: skeleton with BYOK transport (EX1) + error mapping (EX6).
// Day 2 implements split + polish for the onboarding demo.
// Day 4 adds classify for the intake demo.

import Anthropic from '@anthropic-ai/sdk';
import type { WizardError } from './types.js';

export interface AIClientOptions {
  apiKey: string;
  providerBaseURL?: string; // EX1: if set, requests route through this URL instead of api.anthropic.com
}

// createAIClient returns a configured Anthropic client.
// Browser-direct usage requires dangerouslyAllowBrowser: true (named that way for a reason — see EX1).
export function createAIClient(opts: AIClientOptions): Anthropic {
  return new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: true,
    ...(opts.providerBaseURL ? { baseURL: opts.providerBaseURL } : {}),
  });
}

// mapErrorToWizardError: normalizes SDK errors to our discriminated union (EX6).
// Bridge uses this to surface errors via BridgeState.lastError instead of throwing.
export function mapErrorToWizardError(err: unknown): WizardError {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      return { kind: 'ai-invalid-key' };
    }
    if (status === 429) {
      const headers = (err as { headers?: Record<string, string> }).headers ?? {};
      const retryAfterSec = Number(headers['retry-after'] ?? '1');
      return { kind: 'ai-rate-limit', retryAfterMs: retryAfterSec * 1000 };
    }
  }
  if (err instanceof Error) {
    return { kind: 'ai-network', cause: err.message };
  }
  return { kind: 'ai-network', cause: 'unknown error' };
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

// firstText pulls the text out of an Anthropic message response, or throws an
// ai-malformed-response WizardError so the Bridge's error surface can show the
// raw payload (EX6) instead of a generic crash.
function firstText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw { kind: 'ai-malformed-response', raw: JSON.stringify(message.content) };
  }
  return block.text.trim();
}

// split: turn one free-text answer into N discrete items (Pattern 2 — the AI
// proposes a batch the user confirms). One item per line, blanks dropped.
export async function split(client: Anthropic, prompt: string, input: string): Promise<string[]> {
  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: `${prompt}\n\nReturn each distinct item on its own line. No numbering, no preamble.`,
    messages: [{ role: 'user', content: input }],
  });
  return firstText(message)
    .split('\n')
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter((line) => line.length > 0);
}

// polish: rewrite a single answer into cleaner copy without changing meaning.
export async function polish(client: Anthropic, prompt: string, input: string): Promise<string> {
  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: `${prompt}\n\nRewrite the user's text. Return only the rewritten text, nothing else.`,
    messages: [{ role: 'user', content: input }],
  });
  return firstText(message);
}

// classify: pick exactly one category for the input. Falls back to the first
// category if the model returns something off-list.
export async function classify(
  client: Anthropic,
  prompt: string,
  input: string,
  categories: string[],
): Promise<string> {
  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 64,
    system: `${prompt}\n\nClassify the input into exactly one of: ${categories.join(
      ', ',
    )}. Reply with only the category name.`,
    messages: [{ role: 'user', content: input }],
  });
  const answer = firstText(message);
  const match = categories.find((c) => c.toLowerCase() === answer.toLowerCase());
  return match ?? categories[0] ?? answer;
}
