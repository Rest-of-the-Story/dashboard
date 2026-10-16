import type { LighthouseCheck, MonthlyReport } from '../../src/types/report';
import config from '../../src/config/dashboard';
import { compare, AGAINST_MONTH_BEFORE, againstLastYear } from '../../src/lib/trend';
import { describeSources, namePage } from '../../src/lib/sources';
import { analyticsConfigured, saRange } from './simple-analytics';
import { findLighthouse } from './lighthouse';
import { pipeline, pipelineConfigured } from './pipeline';
import { monthBounds, monthLabel, shiftMonth } from './time';

/**
 * The monthly report: a snapshot of one finished calendar month
 * (OVERVIEW-STANDARD 6), built once after the month is over and stored in the
 * agency database through the Pipeline. A report that recalculated every time
 * it was opened would quietly change, and "how did September go" should have
 * one answer.
 *
 * Every source is optional: a failure in one leaves its section out rather
 * than losing the month. Sections Simple Analytics can't supply (towns and
 * cities, returning visitors, automated hits left out) are not in the report
 * at all, and there is no inquiries section until the site saves its form
 * submissions.
 */

/** "/home/" and "/home?fbclid=…" are the same page; "/" redirects to "/home". */
function cleanPath(path: string): string {
  const bare = path.split(/\?|%3F/i)[0]!.replace(/(.)\/+$/, '$1') || '/';
  return bare === '/' ? '/home' : bare;
}

/**
 * Whether a month has a full month of data. The month tracking began is
 * partial, so it is never used as the "month before" or "last year".
 */
export function isComplete(month: string): boolean {
  const since = config.analytics?.trackingSince;
  return !since || `${month}-01` >= since;
}

async function analytics(month: string) {
  if (!analyticsConfigured()) return null;
  const { start, end } = monthBounds(month);
  const totalsOf = async (m: string) => {
    if (!isComplete(m)) return null;
    const b = monthBounds(m);
    return (await saRange(b.start, b.end, ['visitors'])).visitors ?? 0;
  };

  const [now, prevVisits, lastYearVisits] = await Promise.all([
    saRange(start, end, ['visitors', 'pageviews', 'seconds_on_page', 'histogram', 'pages', 'referrers', 'device_types'], 100),
    totalsOf(shiftMonth(month, -1)),
    totalsOf(shiftMonth(month, -12)),
  ]);

  const visits = now.visitors ?? 0;
  const mobile = (now.device_types ?? []).find((d) => d.value === 'mobile')?.visitors;

  // Until 2026-09-17 the dashboard's own pages were counted under the site's
  // hostname; they aren't pages of the website.
  const internal = new Set(config.analytics?.internalRoutes ?? []);
  const pages = new Map<string, number>();
  for (const row of now.pages ?? []) {
    const path = cleanPath(row.value);
    if (internal.has(path)) continue;
    pages.set(path, (pages.get(path) ?? 0) + (row.pageviews ?? 0));
  }

  const referred = (now.referrers ?? []).map((r) => ({ source: r.value, visits: r.visitors ?? 0 }));
  const direct = visits - referred.reduce((sum, r) => sum + r.visits, 0);

  return {
    traffic: {
      visits,
      prevVisits,
      lastYearVisits,
      pageviews: now.pageviews ?? 0,
      secondsOnPage: now.seconds_on_page ?? 0,
      mobileShare: visits && mobile !== undefined ? Math.round((mobile / visits) * 100) : null,
    },
    series: (now.histogram ?? [])
      .filter((p) => p.date >= start && p.date <= end)
      .map((p) => ({ day: p.date, visits: p.visitors ?? 0 })),
    pages: [...pages]
      .map(([path, views]) => ({ path, views }))
      .filter((p) => p.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 8),
    sources: [...(direct > 0 ? [{ source: 'direct', visits: direct }] : []), ...referred].filter((s) => s.visits > 0),
  };
}

// ─── The month in brief ─────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Three to five plain sentences: the things worth knowing about the month. */
export function highlights(r: Omit<MonthlyReport, 'highlights'>): string[] {
  const name = monthLabel(r.month);
  const out: string[] = [];
  const t = r.traffic;

  if (t) {
    const comparisons = [
      compare(t.visits, t.prevVisits, AGAINST_MONTH_BEFORE).text,
      compare(t.visits, t.lastYearVisits, againstLastYear(name)).text,
    ].filter(Boolean).map(lowerFirst);
    out.push(`${plural(t.visits, 'visit', 'visits')} in ${name}${comparisons.length ? `, ${comparisons.join(' and ')}` : ''}.`);

    const next = r.pages.find((p) => p.path !== '/home');
    if (next && next.views >= 3) {
      out.push(`After the homepage, people viewed ${namePage(next.path)} most: ${plural(next.views, 'view', 'views')}.`);
    }

    const fromElsewhere = describeSources(r.sources.filter((s) => s.source !== 'direct'), 99)[0];
    if (fromElsewhere && fromElsewhere.visits >= 3) {
      out.push(`${fromElsewhere.name} brought the most visitors from other sites: ${fromElsewhere.visits.toLocaleString('en-US')}.`);
    }

    if (t.mobileShare !== null && t.visits >= 20) {
      out.push(`${t.mobileShare}% of visits were on a phone.`);
    }
  }

  const mobile = r.lighthouse?.mobile;
  if (mobile) {
    const verdict = mobile.scores.performance >= 90 ? 'fast' : mobile.scores.performance >= 50 ? 'reasonably quick' : 'slow';
    out.push(`On a phone the homepage scored ${mobile.scores.performance} out of 100 for speed in Google's test: ${verdict}.`);
  }

  if (!out.length) out.push(`Visitor figures for ${name} weren't available when this report was written.`);
  return out.slice(0, 5);
}

// ─── Build and store ────────────────────────────────────────────────────────

export async function buildReport(month: string): Promise<MonthlyReport> {
  const settle = async <T>(label: string, task: () => Promise<T>): Promise<T | null> => {
    try {
      return await task();
    } catch (err) {
      console.error(`Monthly report ${month}: ${label} failed:`, err instanceof Error ? err.message : err);
      return null;
    }
  };
  const { start, end } = monthBounds(month);

  const [sa, lighthouse] = await Promise.all([
    settle('analytics', () => analytics(month)),
    pipelineConfigured()
      ? settle<LighthouseCheck | null>('lighthouse', () => findLighthouse({ from: start, to: end }))
      : Promise.resolve(null),
  ]);

  const base: Omit<MonthlyReport, 'highlights'> = {
    month,
    generatedAt: new Date().toISOString(),
    traffic: sa?.traffic ?? null,
    series: sa?.series ?? [],
    pages: sa?.pages ?? [],
    sources: sa?.sources ?? [],
    lighthouse: lighthouse ?? null,
  };
  return { ...base, highlights: highlights(base) };
}

/** Saves a report. Without `replace`, a month that already has one is left as it is. */
export async function saveReport(report: MonthlyReport, replace = false): Promise<boolean> {
  const { written } = await pipeline<{ written: boolean }>('client-site-data?resource=report', {
    method: 'PUT',
    body: { month: report.month, data: report, replace },
  });
  return written;
}

export async function storedMonths(): Promise<string[]> {
  const { months } = await pipeline<{ months: string[] }>('client-site-data?resource=reports');
  return months;
}
