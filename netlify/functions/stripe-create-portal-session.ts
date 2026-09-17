import Stripe from 'stripe';
import { requireUser } from './_auth';

interface RequestBody {
  returnUrl?: string;
}

export async function handler(event: { body: string | null; headers: Record<string, string> }) {
  const auth = await requireUser(event);
  if ('statusCode' in auth) return auth;

  const stripeConfig = process.env.STRIPE_CONFIG;
  if (!stripeConfig) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  try {
    const { secretKey } = JSON.parse(stripeConfig);
    const stripe = new Stripe(secretKey);
    const { returnUrl } = (JSON.parse(event.body || '{}') || {}) as RequestBody;

    // Server-side only: a portal session grants control of the customer's
    // billing, so the caller never gets to name the customer.
    const customerId = process.env.STRIPE_CUSTOMER_ID;
    if (!customerId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'STRIPE_CUSTOMER_ID is not set' }) };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || process.env.URL || 'https://localhost:8888/billing',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, url: session.url }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Portal session error:', message);
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
}
