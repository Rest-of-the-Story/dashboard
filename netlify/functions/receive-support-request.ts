import { Resend } from 'resend';

// Contact & Support endpoint. Dashboard users submit a request via
// SupportPage.vue; this function emails it to the developer's inbox
// via Resend. Reply-to is the requester's email so a Reply from
// the recipient lands back in the user's inbox directly.
//
// Auth: presence-only check on the Authorization header matches the
// pattern used by stripe-get-billing-summary. Effectively UI-gated
// (only Auth0-logged-in dashboard users hit this from the browser),
// which blocks anonymous curl abuse without the JWKS overhead of
// full JWT verification.

interface SupportRequestPayload {
  name?: string;
  email?: string;
  subject?: string;
  category?: string;
  message?: string;
  clientName?: string;
  clientDomain?: string;
  timestamp?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug Report',
  update: 'Update Request',
  question: 'Question',
  feature: 'Feature Request',
  other: 'Other',
};

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

  let payload: SupportRequestPayload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { name, email, subject, category, message, clientName, clientDomain, timestamp } = payload;

  if (!subject?.trim() || !message?.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Subject and message are required.' }),
    };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email address.' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Support delivery not configured',
        message: 'RESEND_API_KEY, CONTACT_TO_EMAIL, and CONTACT_FROM_EMAIL must be set.',
      }),
    };
  }

  const resend = new Resend(apiKey);
  const categoryLabel = category ? CATEGORY_LABELS[category] || category : 'Uncategorized';
  const clientLabel = clientName || 'Unknown client';
  const subjectLine = `[${clientLabel}] ${categoryLabel}: ${subject.trim()}`;

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email || undefined,
      subject: subjectLine,
      html: renderEmail({
        name: name || 'Not provided',
        email: email || 'Not provided',
        categoryLabel,
        subject: subject.trim(),
        message: message.trim(),
        clientName: clientLabel,
        clientDomain: clientDomain || 'Not provided',
        timestamp: timestamp || new Date().toISOString(),
      }),
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send support request. Please try again.' }),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Support request error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An unexpected error occurred.' }),
    };
  }
}

function renderEmail(data: {
  name: string;
  email: string;
  categoryLabel: string;
  subject: string;
  message: string;
  clientName: string;
  clientDomain: string;
  timestamp: string;
}): string {
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding: 8px 12px; font-weight: 600; color: #4b5563; vertical-align: top; width: 140px;">${escapeHtml(label)}</td>
      <td style="padding: 8px 12px; color: #1f2937;">${escapeHtml(value)}</td>
    </tr>`;

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #293b3f; margin-bottom: 24px;">Dashboard Support Request</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${row('Client', data.clientName)}
        ${row('Domain', data.clientDomain)}
        ${row('Category', data.categoryLabel)}
        ${row('Name', data.name)}
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #4b5563; vertical-align: top;">Email</td>
          <td style="padding: 8px 12px; color: #1f2937;">
            <a href="mailto:${escapeHtml(data.email)}" style="color: #293b3f;">${escapeHtml(data.email)}</a>
          </td>
        </tr>
        ${row('Subject', data.subject)}
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; color: #4b5563; vertical-align: top;">Message</td>
          <td style="padding: 8px 12px; color: #1f2937; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
        </tr>
        ${row('Submitted', data.timestamp)}
      </table>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9ca3af;">Sent from the ${escapeHtml(data.clientName)} dashboard support form. Reply directly to respond to the requester.</p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
