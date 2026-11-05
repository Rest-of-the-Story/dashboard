import { useAuth0 } from '@auth0/auth0-vue';

/**
 * The token the dashboard sends to its Netlify functions.
 *
 * We send the Auth0 **ID token**, a JWT signed by the tenant and audienced to
 * this SPA, which the functions verify against the tenant JWKS (see _auth.ts).
 * getAccessTokenSilently() needs a registered Auth0 API (audience); none exists
 * for this tenant, so it fails at runtime — that was the error on Billing,
 * Blog Assist and Support.
 *
 * The ID token expires about 10 hours after sign-in, but the localStorage cache
 * keeps it as long as the access token (about 24). Sending the cached one as is
 * made every function refuse every request for the rest of that day, so an
 * expired or nearly expired token is refreshed first; if the session itself has
 * ended, the person is sent to sign in and brought back to the same page.
 */

/** Refresh a little early, so a token can't expire on its way to the server. */
const EXPIRY_MARGIN_S = 60;

export function useAuthToken() {
  const { idTokenClaims, checkSession, loginWithRedirect } = useAuth0();

  const usable = () => {
    const claims = idTokenClaims.value;
    return Boolean(claims?.__raw && typeof claims.exp === 'number' && claims.exp - EXPIRY_MARGIN_S > Date.now() / 1000);
  };

  return async function authToken(): Promise<string> {
    if (!usable()) {
      // cacheMode 'off' makes Auth0 issue new tokens (via the refresh token)
      // rather than hand back the cached, expired ones.
      await checkSession({ cacheMode: 'off' }).catch(() => undefined);
    }
    if (!usable()) {
      await loginWithRedirect({ appState: { target: window.location.pathname + window.location.search } });
      throw new Error('Your session has expired. Signing you in again…');
    }
    return idTokenClaims.value!.__raw;
  };
}
