/** What the Edit Website page reads and saves (netlify/functions/site-content.ts). */

export interface HoursEntry {
  _key?: string;
  days: string;
  closed: boolean;
  open?: string;
  close?: string;
  note?: string;
}

export interface FaqItem {
  _key?: string;
  question: string;
  /** Light markup (src/lib/richText.ts); null = formatting only the Studio can edit. */
  answer: string | null;
}

export interface SiteContent {
  hours: {
    entries: HoursEntry[];
    /** Pages that show the hours list; all are saved together. */
    pages: string[];
    /** True when those pages currently show different hours. */
    differs: boolean;
  } | null;
  announcement: {
    /** One line per row; null = formatted text only the Studio can edit. */
    text: string | null;
  } | null;
  sale: {
    title: string;
    path: string;
    heading: string;
    body: string | null;
    altText: string;
    imageUrl: string | null;
    inMenu: boolean;
    menuLabel: string;
  } | null;
  faqs: { items: FaqItem[] } | null;
  contact: { phone: string; email: string; places: number } | null;
  /** Section -> Studio document with unpublished changes that would block a save. */
  blocked: Partial<Record<Section, string>>;
  /** Section -> Studio link for anything the dashboard doesn't cover. */
  studio: Partial<Record<Section, string>>;
  /** Document revisions this copy was read at, sent back with each save. */
  revs: Record<string, string>;
}

export type Section = 'hours' | 'announcement' | 'sale' | 'faqs' | 'contact';

export interface SaleSave {
  heading: string;
  body: string | null;
  altText: string;
  inMenu: boolean;
  menuLabel: string;
  /** A new flyer/photo as a data: URL, or 'remove' to take the current one off. */
  image?: string;
}

export type SavePayload =
  | { section: 'hours'; revs: Record<string, string>; data: { entries: HoursEntry[] } }
  | { section: 'announcement'; revs: Record<string, string>; data: { text: string } }
  | { section: 'sale'; revs: Record<string, string>; data: SaleSave }
  | { section: 'faqs'; revs: Record<string, string>; data: { items: FaqItem[] } }
  | { section: 'contact'; revs: Record<string, string>; data: { phone: string; email: string } };
