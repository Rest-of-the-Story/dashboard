const SANITY_PROXY_URL = '/.netlify/functions/sanity-proxy';

// Reads through the server-side proxy, which now requires auth + reads with a
// token. Pass the caller's Auth0 access token (getAccessTokenSilently()).
export async function useSanityQuery<T = unknown>(
  query: string,
  params?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(SANITY_PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, params }),
  });

  if (!res.ok) {
    throw new Error(`Sanity proxy error: ${res.status}`);
  }

  const data = await res.json();
  return data.result as T;
}
