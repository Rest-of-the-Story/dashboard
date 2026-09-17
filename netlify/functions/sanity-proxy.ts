import { createClient } from '@sanity/client';
import { requireUser } from './_auth';

// Server-side read proxy for the dashboard. Reads WITH the project token so it
// sees content the anonymous API doesn't serve (e.g. the postIdea idea library).
//
// Two gates, because this token can read the whole dataset:
//  1. requireUser — a verified Auth0 ID token (see _auth.ts).
//  2. Named queries only. The browser sends a query NAME, never GROQ. Accepting
//     arbitrary GROQ would let any authenticated caller read every document,
//     drafts included, regardless of what the UI offers.
const client = createClient({
  projectId: process.env.NETLIFY_SANITY_PROJECT_ID!,
  dataset: process.env.VITE_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
});

// Add a new entry here when the dashboard needs new data.
const QUERIES: Record<string, string> = {
  // Unused blog ideas, seasonal ones first ($month, e.g. "sep")
  ideaShelf: `*[_type == "postIdea" && used != true]{
    _id, title, angle, category, pillar, audience, needsOwnerStory,
    "seasonal": $month in seasons
  } | order(seasonal desc, _createdAt asc)`,

  // Recent posts, for showing what's already published
  recentPosts: `*[_type == "post"] | order(coalesce(publishedAt, _createdAt) desc)[0...20]{
    _id, title, slug, publishedAt, "categories": categories[]->title
  }`,
};

export async function handler(event: {
  headers: Record<string, string>;
  body: string | null;
}) {
  const auth = await requireUser(event);
  if ('statusCode' in auth) return auth;

  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }) };
  }

  try {
    const { queryName, params } = JSON.parse(event.body);
    const query = queryName ? QUERIES[queryName] : undefined;
    if (!query) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Unknown query. Available: ${Object.keys(QUERIES).join(', ')}`,
        }),
      };
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
