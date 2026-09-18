// The /web entrypoint talks to Turso over HTTP. The default export loads a
// native binding (@libsql/linux-x64-gnu) that Netlify's bundler doesn't ship,
// so the function failed at import with Runtime.ImportModuleError.
import { createClient } from '@libsql/client/web';
import { requireUser } from './_auth';

/**
 * Offline invoices — the ones billed from the Pipeline Dashboard and paid by
 * Zelle or check, which never touch Stripe. Without these the Billing page
 * shows only Stripe history and looks like the client stopped paying.
 *
 * Source of truth is the Pipeline Dashboard's `offline_invoices` table. Two
 * ways to reach it, chosen by the URL scheme:
 *
 *   libsql://…  read the Turso database directly (what's configured today)
 *   https://…   call the Pipeline's get-offline-invoices endpoint instead
 *
 * Direct mode only ever runs the one parameterized SELECT below, scoped to this
 * client. The credential still deserves care: a Turso token is per-database, not
 * per-row, so anything holding it could read every client's billing. Use a
 * READ-ONLY token here (`turso db tokens create <db> --read-only`).
 *
 * Env:
 *   PIPELINE_API_URL    libsql://… database, or https://…/.netlify/functions
 *   PIPELINE_API_TOKEN  Turso auth token (read-only), or the Pipeline's service credential
 *   PIPELINE_CLIENT_ID  this client's row id in the Pipeline database
 *
 * Unconfigured, it returns an empty list rather than an error, so Billing keeps
 * working on Stripe data alone.
 */

export interface OfflineInvoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  description: string | null;
  created: number;
  dueDate: number | null;
  paidAt: number | null;
  status: string;
  paymentMethod: string | null;
  source: 'offline';
}

const SELECT_INVOICES = `
  SELECT id, invoice_number, amount, status, product_description,
         due_date, sent_date, paid_date, payment_method, created_at
  FROM offline_invoices
  WHERE client_id = ?
    AND status != 'draft'
    AND status != 'cancelled'
  ORDER BY COALESCE(paid_date, due_date) DESC
  LIMIT 24
`;

const toEpoch = (value: unknown): number | null => {
  if (!value) return null;
  // Turso stores ISO-ish strings ("2026-08-11" or "2026-08-11 14:02:00").
  const ms = Date.parse(String(value).replace(' ', 'T'));
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
};

const normalize = (row: Record<string, any>): OfflineInvoice => ({
  id: String(row.id ?? row.invoiceNumber ?? row.invoice_number),
  number: row.invoice_number ?? row.invoiceNumber ?? null,
  // Cents, same as Stripe.
  amount: Number(row.amount ?? 0),
  currency: 'usd',
  description: row.product_description ?? row.productDescription ?? null,
  created: toEpoch(row.created_at ?? row.createdAt) ?? 0,
  dueDate: toEpoch(row.due_date ?? row.dueDate),
  paidAt: toEpoch(row.paid_date ?? row.paidDate),
  status: String(row.status ?? 'sent'),
  paymentMethod: row.payment_method ?? row.paymentMethod ?? null,
  source: 'offline',
});

async function fromDatabase(url: string, authToken: string, clientId: string) {
  // The HTTP client wants https://, while Turso hands out libsql:// URLs.
  const db = createClient({ url: url.replace(/^libsql:\/\//, 'https://'), authToken });
  const { rows } = await db.execute({ sql: SELECT_INVOICES, args: [clientId] });
  return rows.map(row => normalize(row as unknown as Record<string, any>));
}

async function fromPipelineApi(base: string, token: string, clientId: string) {
  const url = `${base.replace(/\/$/, '')}/get-offline-invoices?clientId=${encodeURIComponent(clientId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Pipeline returned ${res.status}`);
  const data = await res.json();
  return ((data.invoices || data.data || []) as Record<string, any>[]).map(normalize);
}

export async function handler(event: { headers: Record<string, string> }) {
  const auth = await requireUser(event);
  if ('statusCode' in auth) return auth;

  const url = process.env.PIPELINE_API_URL;
  const token = process.env.PIPELINE_API_TOKEN;
  const clientId = process.env.PIPELINE_CLIENT_ID;

  if (!url || !token || !clientId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoices: [], configured: false }),
    };
  }

  try {
    const invoices = url.startsWith('libsql://') || url.includes('turso.io')
      ? await fromDatabase(url, token, clientId)
      : await fromPipelineApi(url, token, clientId);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoices, configured: true }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Offline invoice lookup failed:', message);
    return {
      statusCode: 502,
      body: JSON.stringify({ success: false, error: 'Could not load offline invoices' }),
    };
  }
}
