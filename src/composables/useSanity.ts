import { apiFetch } from './useApi';

// Reads go through the server-side proxy, which holds the Sanity token and only
// runs queries it defines itself (see netlify/functions/sanity-proxy.ts).
// Pass the caller's Auth0 ID token — see useAuthToken().
export async function useSanityQuery<T = unknown>(
  queryName: string,
  params?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const data = await apiFetch<{ result: T }>('/.netlify/functions/sanity-proxy', {
    method: 'POST',
    token,
    body: JSON.stringify({ queryName, params }),
  });

  return data.result;
}
