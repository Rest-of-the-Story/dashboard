import { createClient } from '@sanity/client';

// Blog-assist: add a new postIdea to the shelf from the dashboard, so the client
// can replenish ideas without opening Studio. Writes with SANITY_WRITE_TOKEN.
// Presence-only Authorization check (house style); the page sends the Auth0 token.

interface CreateIdeaPayload {
  title?: string;
  angle?: string;
  category?: string;
  pillar?: string;
  seasons?: string[];
  audience?: string;
  needsOwnerStory?: boolean;
}

const CATEGORIES = ['community', 'faith', 'parenting', 'thrifting'];
const PILLARS = ['kids', 'homeschool', 'maternity', 'general'];
const AUDIENCES = ['youngMom', 'parent'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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

  let payload: CreateIdeaPayload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const title = payload.title?.trim();
  const angle = payload.angle?.trim();
  const category = payload.category;

  if (!title || !angle || !category) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Title, angle, and category are required.' }) };
  }
  if (!CATEGORIES.includes(category)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid category.' }) };
  }

  const projectId = process.env.NETLIFY_SANITY_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID;
  const dataset = process.env.VITE_SANITY_DATASET || 'production';
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!projectId || !token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Not configured (NETLIFY_SANITY_PROJECT_ID / SANITY_WRITE_TOKEN).' }) };
  }

  const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

  // Sanitize optional fields against the schema's allowed values.
  const pillar = payload.pillar && PILLARS.includes(payload.pillar) ? payload.pillar : undefined;
  const audience = payload.audience && AUDIENCES.includes(payload.audience) ? payload.audience : undefined;
  const seasons = Array.isArray(payload.seasons) ? payload.seasons.filter((m) => MONTHS.includes(m)) : [];

  try {
    // No _id → Sanity assigns a published id (not a draft), so it shows on the shelf.
    const doc = await client.create({
      _type: 'postIdea',
      title: title.slice(0, 90),
      angle,
      category,
      ...(pillar ? { pillar } : {}),
      ...(seasons.length ? { seasons } : {}),
      ...(audience ? { audience } : {}),
      needsOwnerStory: !!payload.needsOwnerStory,
      used: false,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        idea: {
          _id: doc._id,
          title: doc.title,
          angle: doc.angle,
          category: doc.category,
          pillar: doc.pillar,
          audience: doc.audience,
          needsOwnerStory: doc.needsOwnerStory,
          seasonal: seasons.includes(new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase()),
        },
      }),
    };
  } catch (err) {
    console.error('Create-idea error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to add the idea. Please try again.' }) };
  }
}
