// Server-side Anthropic proxy for the demos.
//
// Lets you set ANTHROPIC_API_KEY in .env.local instead of pasting a key in the
// UI. The key stays on the server and is never sent to the browser — the client
// POSTs { prompt, input } here and gets back the split items.
//
// GET  → { hasServerKey } so the UI knows whether an env key is available.
// POST → { items } from ai.split using the server key.

import { NextResponse } from 'next/server';
// Import the pure AI layer directly (no React) so this server route doesn't pull
// the client component surface into the server bundle.
import { createAIClient, split } from '@flowgent/core/ai';

export const dynamic = 'force-dynamic'; // read env per-request, never prerender

export function GET() {
  return NextResponse.json({ hasServerKey: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'no-server-key' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }

  const { prompt, input } = (body ?? {}) as { prompt?: unknown; input?: unknown };
  if (typeof prompt !== 'string' || typeof input !== 'string') {
    return NextResponse.json({ error: 'prompt and input must be strings' }, { status: 400 });
  }

  try {
    const client = createAIClient({ apiKey: key });
    const items = await split(client, prompt, input);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: 'ai-error', detail: String(err) }, { status: 502 });
  }
}
