import { requireUser } from './_auth';
import { analyticsConfigured, saRange } from '../lib/simple-analytics';
import { localToday, shiftMonth } from '../lib/time';

/**
 * Analytics Proxy — fetches from Simple Analytics API on behalf of the dashboard.
 * Keeps the SA API key server-side so it's never exposed to the client.
 *
 * Auth required (see _auth.ts): without it this was an open proxy in front of a
 * paid API key — any caller could pull stats for any hostname. The hostname is
 * pinned server-side for the same reason; only the date range comes from the UI.
 *
 * Query params: start, end (YYYY-MM-DD), or period=mtd for the overview's
 * "this month so far" card.
 * Env: see ../lib/simple-analytics.ts and ../lib/time.ts
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Responses depend on who is asking, so no shared cache may keep them. */
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' };

const reply = (statusCode: number, body: unknown) => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) });

/**
 * This month through today, against the same days of last month (the 1st to
 * the same day-of-month, capped at that month's length), plus a daily series.
 */
async function monthToDate() {
  const today = localToday();
  const thisMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const [y, m] = lastMonth.split('-').map(Number) as [number, number];
  const lastMonthLength = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const sameDay = String(Math.min(Number(today.slice(8)), lastMonthLength)).padStart(2, '0');

  const [current, previous] = await Promise.all([
    saRange(`${thisMonth}-01`, today, ['visitors', 'pageviews', 'seconds_on_page', 'histogram']),
    saRange(`${lastMonth}-01`, `${lastMonth}-${sameDay}`, ['visitors']),
  ]);

  return {
    configured: true,
    period: 'mtd',
    current: {
      visitors: current.visitors ?? 0,
      pageviews: current.pageviews ?? 0,
      secondsOnPage: current.seconds_on_page ?? 0,
    },
    previous: { visitors: previous.visitors ?? 0 },
    series: (current.histogram ?? [])
      .filter((p) => p.date <= today)
      .map((p) => ({ key: p.date, visitors: p.visitors ?? 0 })),
  };
}

export async function handler(event: {
  queryStringParameters: Record<string, string> | null;
  headers: Record<string, string>;
}) {
  const auth = await requireUser(event);
  if ('statusCode' in auth) return auth;

  const { start, end, period } = event.queryStringParameters || {};

  // The overview treats "not configured" as an empty state, not an error.
  if (period === 'mtd') {
    if (!analyticsConfigured()) return reply(200, { configured: false });
    try {
      return reply(200, await monthToDate());
    } catch (err) {
      console.error('Analytics proxy (mtd) error:', err);
      return reply(502, { error: 'Could not load analytics' });
    }
  }

  if (!analyticsConfigured()) {
    return reply(500, {
      error: 'Analytics not configured',
      message: 'Set SIMPLE_ANALYTICS_API_KEY and ANALYTICS_HOSTNAME in the Netlify environment variables.',
    });
  }
  // Only plain dates reach the upstream request.
  if (!start || !end || !DAY.test(start) || !DAY.test(end)) {
    return reply(400, { error: 'Missing or malformed params: start, end (YYYY-MM-DD)' });
  }

  try {
    const data = await saRange(start, end, ['pageviews', 'visitors', 'seconds_on_page', 'pages', 'referrers'], 20);
    return reply(200, {
      pageviews: data.pageviews ?? 0,
      visitors: data.visitors ?? 0,
      seconds_on_page: data.seconds_on_page ?? 0,
      pages: (data.pages ?? []).slice(0, 20),
      referrers: (data.referrers ?? []).slice(0, 20),
    });
  } catch (err) {
    console.error('Analytics proxy error:', err instanceof Error ? err.message : err);
    return reply(502, { error: 'Could not load analytics' });
  }
}
