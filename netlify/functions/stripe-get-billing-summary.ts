import Stripe from 'stripe';
import { requireUser } from './_auth';

interface BillingSummary {
  subscription: {
    id: string;
    status: string;
    planName: string;
    amount: number;
    currency: string;
    interval: string;
    nextBillingDate: number | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  pendingCharges: Array<{
    id: string;
    number: string | null;
    amount: number;
    currency: string;
    description: string | null;
    created: number;
    dueDate: number | null;
    hostedInvoiceUrl: string | null;
  }>;
  recentPayments: Array<{
    id: string;
    number: string | null;
    amount: number;
    currency: string;
    description: string | null;
    created: number;
    paidAt: number | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

export async function handler(event: { queryStringParameters: Record<string, string> | null; headers: Record<string, string> }) {
  const auth = await requireUser(event);
  if ('statusCode' in auth) return auth;

  // The customer is fixed server-side. Taking it from the request let anyone
  // read (and with the portal, control) any customer in the Stripe account.
  const customerId = process.env.STRIPE_CUSTOMER_ID;
  if (!customerId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'STRIPE_CUSTOMER_ID is not set' }) };
  }

  const stripeConfig = process.env.STRIPE_CONFIG;
  if (!stripeConfig) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  try {
    const { secretKey } = JSON.parse(stripeConfig);
    const stripe = new Stripe(secretKey);

    // Fetch customer with default payment method expanded
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    if (customer.deleted) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Customer not found' }) };
    }

    // Fetch active subscriptions (expand limited to 3 levels)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
      expand: ['data.default_payment_method'],
    });

    let subscription: BillingSummary['subscription'] = null;
    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const item = sub.items.data[0];
      // Fetch product name separately to avoid deep expand
      let productName = 'Subscription';
      if (item?.price?.product) {
        const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id;
        try {
          const product = await stripe.products.retrieve(productId);
          productName = product.name;
        } catch { /* fallback to default */ }
      }

      subscription = {
        id: sub.id,
        status: sub.status,
        planName: productName,
        amount: item?.price?.unit_amount || 0,
        currency: item?.price?.currency || 'usd',
        interval: item?.price?.recurring?.interval || 'month',
        nextBillingDate: (sub as any).current_period_end ?? null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    }

    // Fetch open invoices (pending charges)
    const openInvoices = await stripe.invoices.list({
      customer: customerId,
      status: 'open',
      limit: 10,
    });

    const pendingCharges: BillingSummary['pendingCharges'] = openInvoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount_due,
      currency: inv.currency,
      description: inv.description,
      created: inv.created,
      dueDate: inv.due_date,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    }));

    // Paid invoices from the primary customer plus any legacy records. The
    // client's billing moved to a new Stripe customer, so their earlier
    // payments live on the old one; STRIPE_LEGACY_CUSTOMER_IDS (comma
    // separated) folds that history in. Read-only: the subscription, payment
    // method and portal all stay on the primary customer.
    const legacyIds = (process.env.STRIPE_LEGACY_CUSTOMER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id && id !== customerId);

    const paidInvoiceSets = await Promise.all(
      [customerId, ...legacyIds].map(id =>
        stripe.invoices
          .list({ customer: id, status: 'paid', limit: 10 })
          .catch(err => {
            console.warn(`Could not read invoices for ${id}:`, err instanceof Error ? err.message : err);
            return { data: [] as Stripe.Invoice[] };
          })
      )
    );

    const paidInvoices = {
      data: paidInvoiceSets
        .flatMap(set => set.data)
        .sort((a, b) => b.created - a.created)
        .slice(0, 10),
    };

    const recentPayments: BillingSummary['recentPayments'] = paidInvoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount_paid,
      currency: inv.currency,
      description: inv.description,
      created: inv.created,
      paidAt: inv.status_transitions?.paid_at ?? null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
    }));

    // Default payment method
    let paymentMethod: BillingSummary['paymentMethod'] = null;
    const defaultPM = customer.invoice_settings?.default_payment_method;
    if (defaultPM && typeof defaultPM === 'object' && 'card' in defaultPM && defaultPM.card) {
      paymentMethod = {
        brand: defaultPM.card.brand || 'unknown',
        last4: defaultPM.card.last4 || '****',
        expMonth: defaultPM.card.exp_month || 0,
        expYear: defaultPM.card.exp_year || 0,
      };
    }

    const summary: BillingSummary = {
      subscription,
      pendingCharges,
      recentPayments,
      paymentMethod,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, ...summary }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Billing summary error:', message);
    return { statusCode: 500, body: JSON.stringify({ error: message }) };
  }
}
