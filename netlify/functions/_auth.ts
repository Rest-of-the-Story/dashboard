import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Shared auth gate for every dashboard function.
 *
 * Replaces the old "an Authorization header exists" check, which any caller
 * could satisfy with a made-up value. We verify the Auth0 ID token (a JWT the
 * SPA already holds) against the tenant's public keys: signature, issuer,
 * audience (= the SPA client id) and expiry.
 *
 * Optional AUTH0_ALLOWED_EMAILS (comma separated) restricts access to named
 * accounts, so a stray signup in the tenant can't reach client data.
 *
 * Env: AUTH0_DOMAIN, AUTH0_CLIENT_ID, optional AUTH0_ALLOWED_EMAILS.
 */

export interface AuthedUser {
  sub: string;
  email?: string;
}

export interface AuthFailure {
  statusCode: number;
  body: string;
}

const domain = () => (process.env.AUTH0_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function keyStore() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`https://${domain()}/.well-known/jwks.json`));
  return jwks;
}

const deny = (message: string, statusCode = 401): AuthFailure => ({
  statusCode,
  body: JSON.stringify({ error: message }),
});

/**
 * Returns the verified user, or an AuthFailure to return from the handler.
 * Call as: const auth = await requireUser(event); if ('statusCode' in auth) return auth;
 */
export async function requireUser(event: {
  headers: Record<string, string | undefined>;
}): Promise<AuthedUser | AuthFailure> {
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!domain() || !clientId) {
    console.error('Auth not configured: AUTH0_DOMAIN and AUTH0_CLIENT_ID are required.');
    return deny('Auth not configured', 500);
  }

  const header = event.headers?.['authorization'] || event.headers?.['Authorization'];
  const token = header?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return deny('Unauthorized');

  try {
    const { payload } = await jwtVerify(token, keyStore(), {
      issuer: `https://${domain()}/`,
      audience: clientId,
    });

    const allowed = (process.env.AUTH0_ALLOWED_EMAILS || '')
      .split(',')
      .map(entry => entry.trim().toLowerCase())
      .filter(Boolean);
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;

    if (allowed.length && (!email || !allowed.includes(email))) {
      console.warn('Signed in but not on AUTH0_ALLOWED_EMAILS:', email ?? '(no email claim)');
      return deny('This account is not on the dashboard access list', 403);
    }

    return { sub: String(payload.sub), email };
  } catch (err) {
    // Say why, so a broken setup can be diagnosed from the page rather than
    // only from the function log. None of these reveal anything secret.
    const code = (err as { code?: string })?.code;
    const claim = (err as { claim?: string })?.claim;
    console.warn('Token rejected:', code, claim ?? '', err instanceof Error ? err.message : err);
    if (code === 'ERR_JWT_EXPIRED') return deny('Session token expired');
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud') return deny('Token is for a different Auth0 application (check AUTH0_CLIENT_ID)');
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'iss') return deny('Token is from a different Auth0 tenant (check AUTH0_DOMAIN)');
    if (code === 'ERR_JWKS_NO_MATCHING_KEY' || code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return deny('Token signature not recognized (check AUTH0_DOMAIN)');
    return deny('Unauthorized');
  }
}
