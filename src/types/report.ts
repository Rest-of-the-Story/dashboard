/**
 * A stored monthly report: a snapshot of one finished calendar month, built by
 * netlify/lib/report.ts and kept in the agency database (OVERVIEW-STANDARD 6).
 *
 * Sections whose source isn't connected are null or empty and left off the
 * page, never shown as zeros. There is no inquiries section until the site
 * saves its form submissions (4.3).
 */
export interface MonthlyReport {
  month: string;
  generatedAt: string;
  traffic: {
    visits: number;
    /** Null when the month before has no data to compare with. */
    prevVisits: number | null;
    lastYearVisits: number | null;
    pageviews: number;
    /** Simple Analytics' typical (median) time on a page. */
    secondsOnPage: number;
    mobileShare: number | null;
  } | null;
  series: { day: string; visits: number }[];
  /** Ranked by page views: Simple Analytics counts a page's visitors only where a visit began. */
  pages: { path: string; views: number }[];
  /** Referrers as Simple Analytics names them; "Direct" is the visits with none. */
  sources: { source: string; visits: number }[];
  /** The first test taken during the month (6.1). */
  lighthouse: LighthouseCheck | null;
  highlights: string[];
}

export type Rating = 'good' | 'needs-work' | 'poor';

export interface LighthouseResult {
  strategy: 'mobile' | 'desktop';
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  metrics: {
    lcp: { value: number; rating: Rating };
    cls: { value: number; rating: Rating };
    tbt: { value: number; rating: Rating };
  };
}

export interface LighthouseCheck {
  url: string;
  checkedAt: string;
  mobile: LighthouseResult | null;
  desktop: LighthouseResult | null;
}

/** The web team's published write-up for the month, from the agency's monthly_reports. */
export interface ReportNotes {
  summary: string;
  recommendations: string;
}
