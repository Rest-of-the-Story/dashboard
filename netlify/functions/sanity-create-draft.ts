import { createClient } from '@sanity/client';
import { randomUUID } from 'crypto';

// Blog-assist: create a Sanity `post` DRAFT from a chosen postIdea, and mark
// the idea used. Writes with SANITY_WRITE_TOKEN (Editor role) — server-side only.
//
// SECURITY: presence-only Authorization check, matching the dashboard house
// style. The page sends the caller's Auth0 token (getAccessTokenSilently), so
// a request requires an authenticated session to obtain one; a fabricated
// header still passes, but the only reachable action is creating an *unpublished
// draft* (never published), whose blast radius is draft spam an editor deletes.
// HARDENING (future): verify the Auth0 id_token against the tenant JWKS
// (audience = client id) before writing. Left as a follow-up to avoid requiring
// an Auth0 API/audience setup for v1.

interface CreateDraftPayload {
  ideaId?: string;
  title?: string;
  angle?: string;
  category?: string;
  pillar?: string;
  audience?: string;
  needsOwnerStory?: boolean;
}

const AUDIENCE_LABELS: Record<string, string> = {
  youngMom: 'the young mom (16–20)',
  parent: 'the parent (20–40)',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 96);
}

// Portable-text block from a plain string.
function block(text: string) {
  return {
    _type: 'block',
    _key: randomUUID().slice(0, 8),
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: randomUUID().slice(0, 8), text, marks: [] }],
  };
}

export async function handler(event: {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | null;
}) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let payload: CreateDraftPayload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { ideaId, title, angle, category, pillar, audience, needsOwnerStory } = payload;

  if (!title?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'title is required.' }) };
  }

  const projectId = process.env.NETLIFY_SANITY_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.VITE_SANITY_DATASET || 'production';
  const token = process.env.SANITY_WRITE_TOKEN;

  if (!projectId || !token) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Draft creation not configured',
        message: 'NETLIFY_SANITY_PROJECT_ID and SANITY_WRITE_TOKEN must be set.',
      }),
    };
  }

  const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

  try {
    // Best-effort: resolve the idea's category (a plain string) to a category
    // reference so the draft lands pre-tagged. Omitted if no match — the editor
    // sets it in Studio.
    let categories: unknown[] | undefined;
    if (category) {
      const catId: string | null = await client.fetch(
        '*[_type == "category" && (lower(title) == $c || slug.current == $c)][0]._id',
        { c: category.toLowerCase() },
      );
      if (catId) {
        categories = [{ _type: 'reference', _key: randomUUID().slice(0, 8), _ref: catId }];
      }
    }

    // A frame, not a finished post — bracketed guidance the writer replaces,
    // per the blog-assist grounding rules (never invent people/quotes).
    // A+ scaffold: a guided section skeleton (not prose — that's the future
    // Option B). Bracketed prompts follow the grounding voice rules; the writer
    // replaces each one.
    const audienceLabel = audience ? AUDIENCE_LABELS[audience] || audience : null;
    const body = [
      block(`[Angle: ${angle || 'see the idea shelf.'}]`),
      audienceLabel
        ? block(`[Write the whole post to ${audienceLabel}. Aim for 400–700 words, plain and specific.]`)
        : null,
      block('[Open — something concrete and specific. No rhetorical-question opener, no “ever wonder…”.]'),
      block('[Middle — the useful part. Name real things: brands, sizes, seasons, streets, prices. Earn the read.]'),
      needsOwnerStory
        ? block('[Andy / Heather — a real story goes here. Do not invent one.]')
        : null,
      block('[Close — warm and plain. No hard sell, and go easy on exclamation points.]'),
      block('[Image idea: a photo you could actually take in the shop.]'),
    ].filter(Boolean);

    const draftId = `drafts.${randomUUID()}`;
    await client.create({
      _id: draftId,
      _type: 'post',
      title: title.trim(),
      slug: { _type: 'slug', current: slugify(title) },
      body,
      ...(categories ? { categories } : {}),
      // No publishedAt — it stays an unpublished draft until an editor publishes.
    });

    // Mark the source idea used so it drops off the shelf (best-effort).
    if (ideaId) {
      try {
        await client.patch(ideaId).set({ used: true }).commit();
      } catch (e) {
        console.warn('Draft created but failed to mark idea used:', ideaId, e);
      }
    }

    const baseId = draftId.replace(/^drafts\./, '');
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, draftId, baseId, title: title.trim() }),
    };
  } catch (err) {
    console.error('Create-draft error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create the draft. Please try again.' }),
    };
  }
}
