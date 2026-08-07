import { createClient } from '@sanity/client';

// Server-side read proxy for the dashboard. Reads WITH the project token so it
// sees content the anonymous API doesn't serve (e.g. the postIdea idea library),
// which is correct here — the dashboard is an authenticated admin tool, not the
// public site. Because it now carries a token, it must not be an open endpoint:
// presence-only Authorization check (house style; the page sends the caller's
// Auth0 token). The client only ever calls .fetch(), so it can read but not write.
const client = createClient({
  projectId: process.env.NETLIFY_SANITY_PROJECT_ID!,
  dataset: process.env.VITE_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
});

export async function handler(event: {
  headers: Record<string, string>;
  body: string | null;
}) {
  const authHeader = event.headers?.['authorization'] || event.headers?.['Authorization'];
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
  }

  try {
    const { query, params } = JSON.parse(event.body);
    if (!query) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
    }

    const result = await client.fetch(query, params || {});
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
}
