import { createClient, type Transaction } from '@sanity/client';
import { randomUUID } from 'crypto';
import { requireUser } from './_auth';
import config from '../../src/config/dashboard';
import { blocksToLines, fromMarkup, linesToBlocks, toMarkup, type Block } from '../../src/lib/richText';
import type { FaqItem, HoursEntry, SaleSave, SavePayload, Section, SiteContent } from '../../src/types/siteContent';

/**
 * Edit Website: the handful of things the shop changes most, edited from the
 * dashboard and written straight to the published content in Sanity. The site
 * reads Sanity live, so a save shows on the website within a minute.
 *
 *   hours         Store hours & closures, on every page that lists them
 *   announcement  The message beside the logo in the site header
 *   sale          The sale page (heading, text, flyer) and its menu link
 *   faqs          FAQ questions and answers
 *   contact       Phone and email, everywhere they appear
 *
 * GET returns the current values; POST { section, revs, data } saves one
 * section. Two safeguards keep the Studio and the dashboard from overwriting
 * each other:
 *  - every write carries the revision it was read at, so a change made in the
 *    Studio meanwhile makes the save fail instead of being lost;
 *  - a document with unpublished Studio changes isn't written at all, since
 *    publishing that draft later would silently undo the dashboard's edit.
 *
 * Auth: verified Auth0 ID token (_auth.ts). Writes with SANITY_WRITE_TOKEN.
 */

const projectId = process.env.NETLIFY_SANITY_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.VITE_SANITY_DATASET || 'production';
const token = process.env.SANITY_WRITE_TOKEN;
const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false, perspective: 'published' });

const STUDIO = (config.links.find((l) => /studio/i.test(l.label))?.url || '').replace(/\/$/, '');
const SALE_SLUG = config.website?.salePageSlug;

const MAX_IMAGE_BYTES = 4_200_000; // keeps the request under Netlify's 6 MB body limit
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const QUERY = `{
  "nav": *[_type == "navigation"][0]{ _id, _rev, grandOpeningMessage, links[]{ _key, label, "ref": internalLink._ref } },
  "faq": *[_type == "faqPage"][0]{ _id, _rev, faqs[]{ _key, _type, question, answer } },
  "footer": *[_type == "mainFooter"][0]{ _id, _rev, contactInfo{ phone, email } },
  "pages": *[_type == "page"]{
    _id, _rev, title, "slug": slug.current,
    "hours": content[_type == "contactInfoSection" && defined(hours)]{ _key, hours },
    "contacts": content[_type == "contactInfoSection" && defined(contacts)]{ _key, "items": contacts[]{ _key, phone, email } },
    "cards": content[_type == "contactCardSection"]{ _key, "items": contactCards[_type in ["phoneCard", "emailCard"]]{ _key, _type, number, address } },
    "sale": select(slug.current == $saleSlug => content[_type == "textImageSection"][0]{
      _key, heading, body, altText, "imageUrl": image.asset->url
    })
  }
}`;

interface PageRow {
  _id: string; _rev: string; title: string; slug: string;
  hours: { _key: string; hours: HoursEntry[] }[] | null;
  contacts: { _key: string; items: { _key: string; phone?: string; email?: string }[] | null }[] | null;
  cards: { _key: string; items: { _key: string; _type: string; number?: string; address?: string }[] | null }[] | null;
  sale: { _key: string; heading?: string; body?: Block[]; altText?: string; imageUrl?: string } | null;
}
interface Raw {
  nav: { _id: string; _rev: string; grandOpeningMessage?: Block[]; links?: { _key: string; label: string; ref?: string }[] } | null;
  faq: { _id: string; _rev: string; faqs?: { _key: string; _type?: string; question?: string; answer?: Block[] }[] } | null;
  footer: { _id: string; _rev: string; contactInfo?: { phone?: string; email?: string } } | null;
  pages: PageRow[];
}

class Refusal extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const key = () => randomUUID().replace(/-/g, '').slice(0, 12);
const keepKey = (k: unknown) => (typeof k === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(k) ? k : key());
const keyed = (k: string) => `[_key == ${JSON.stringify(k)}]`;
const studioLink = (id: string, type: string) => (STUDIO ? `${STUDIO}/intent/edit/id=${id};type=${type}/` : '');
const str = (v: unknown, max: number, label: string, required = false): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new Refusal(`${label} can't be empty.`);
  if (s.length > max) throw new Refusal(`${label} is too long (${max} characters at most).`);
  return s;
};

const pageLabel = (p: { title?: string; slug?: string }) => (p.slug === 'home' ? 'Home' : p.title || p.slug || 'page');

async function load(): Promise<Raw> {
  return client.fetch<Raw>(QUERY, { saleSlug: SALE_SLUG ?? '' });
}

/** Which documents each section writes, with a name the client will recognise. */
function targets(raw: Raw, section: Section): { id: string; label: string }[] {
  const pages = (filter: (p: PageRow) => boolean, what: string) =>
    raw.pages.filter(filter).map((p) => ({ id: p._id, label: `${pageLabel(p)} page (${what})` }));
  switch (section) {
    case 'hours':
      return pages((p) => Boolean(p.hours?.length), 'hours');
    case 'announcement':
      return raw.nav ? [{ id: raw.nav._id, label: 'Navigation (header)' }] : [];
    case 'sale': {
      const sale = raw.pages.find((p) => p.sale);
      return [
        ...(sale ? [{ id: sale._id, label: `${sale.title} page` }] : []),
        ...(raw.nav ? [{ id: raw.nav._id, label: 'Navigation (menu)' }] : []),
      ];
    }
    case 'faqs':
      return raw.faq ? [{ id: raw.faq._id, label: 'FAQ page' }] : [];
    case 'contact':
      return [
        ...(raw.footer ? [{ id: raw.footer._id, label: 'Footer' }] : []),
        ...pages((p) => Boolean(p.contacts?.length || p.cards?.length), 'contact details'),
      ];
  }
}

const SECTIONS: Section[] = ['hours', 'announcement', 'sale', 'faqs', 'contact'];

async function view(raw: Raw): Promise<SiteContent> {
  const allIds = [...new Set(SECTIONS.flatMap((s) => targets(raw, s).map((t) => t.id)))];
  const drafts = new Set(
    await client.fetch<string[]>('*[_id in $ids]._id', { ids: allIds.map((id) => `drafts.${id}`) }, { perspective: 'raw' }),
  );

  const blocked: SiteContent['blocked'] = {};
  for (const s of SECTIONS) {
    const t = targets(raw, s).find((t) => drafts.has(`drafts.${t.id}`));
    if (t) blocked[s] = t.label;
  }

  const revs: Record<string, string> = {};
  for (const doc of [raw.nav, raw.faq, raw.footer, ...raw.pages]) if (doc) revs[doc._id] = doc._rev;

  // Hours: the Contact page's list is the fullest, so it leads.
  const hourPages = raw.pages.filter((p) => p.hours?.length).sort((a, b) => Number(b.slug === 'contact') - Number(a.slug === 'contact'));
  const hourLists = hourPages.flatMap((p) => p.hours!.map((h) => h.hours ?? []));
  const strip = (list: HoursEntry[]) =>
    JSON.stringify(list.map(({ days, closed, open, close, note }) => ({ days, closed: Boolean(closed), ...(closed ? {} : { open, close }), note: note || '' })));

  const salePage = raw.pages.find((p) => p.sale);
  const sale = salePage?.sale;
  const menuLink = salePage && raw.nav?.links?.find((l) => l.ref === salePage._id);

  const contactSources = [
    raw.footer?.contactInfo,
    ...raw.pages.flatMap((p) => (p.contacts ?? []).flatMap((c) => c.items ?? [])),
  ].filter(Boolean) as { phone?: string; email?: string }[];
  const cardItems = raw.pages.flatMap((p) => (p.cards ?? []).flatMap((c) => c.items ?? []));

  const homePage = raw.pages.find((p) => p.slug === 'home');
  return {
    hours: hourLists.length
      ? {
          entries: hourLists[0].map(({ _key, days, closed, open, close, note }) => ({ _key, days, closed: Boolean(closed), open, close, note })),
          pages: hourPages.map(pageLabel),
          differs: new Set(hourLists.map(strip)).size > 1,
        }
      : null,
    announcement: raw.nav ? { text: blocksToLines(raw.nav.grandOpeningMessage) } : null,
    sale:
      salePage && sale
        ? {
            title: salePage.title,
            path: `/${salePage.slug}`,
            heading: sale.heading ?? '',
            body: toMarkup(sale.body),
            altText: sale.altText ?? '',
            imageUrl: sale.imageUrl ?? null,
            inMenu: Boolean(menuLink),
            menuLabel: menuLink?.label ?? salePage.title,
          }
        : null,
    faqs: raw.faq
      ? { items: (raw.faq.faqs ?? []).map((f) => ({ _key: f._key, question: f.question ?? '', answer: toMarkup(f.answer) })) }
      : null,
    contact: contactSources.length
      ? {
          phone: contactSources.find((c) => c.phone)?.phone ?? '',
          email: contactSources.find((c) => c.email)?.email ?? '',
          places: contactSources.length + cardItems.length,
        }
      : null,
    blocked,
    studio: {
      ...(homePage ? { hours: studioLink(homePage._id, 'page') } : {}),
      ...(raw.nav ? { announcement: studioLink(raw.nav._id, 'navigation') } : {}),
      ...(salePage ? { sale: studioLink(salePage._id, 'page') } : {}),
      ...(raw.faq ? { faqs: studioLink(raw.faq._id, 'faqPage') } : {}),
      ...(raw.footer ? { contact: studioLink(raw.footer._id, 'mainFooter') } : {}),
    },
    revs,
  };
}

// ── Writers ─────────────────────────────────────────────────────────────────

type Patch = (tx: Transaction, rev: (id: string) => string) => void;

function hoursPatches(raw: Raw, data: { entries: HoursEntry[] }): Patch[] {
  if (!Array.isArray(data.entries)) throw new Refusal('No hours were sent.');
  if (data.entries.length > 20) throw new Refusal('That is more rows than the hours list can show (20 at most).');
  const entries = data.entries.map((e, i) => {
    const row = `Row ${i + 1}`;
    const closed = Boolean(e.closed);
    const entry: Record<string, unknown> = {
      _type: 'storeHoursEntry',
      _key: keepKey(e._key),
      days: str(e.days, 60, `${row}: Days`, true),
      closed,
    };
    if (!closed) {
      entry.open = str(e.open, 20, `${row}: Opening time`, true);
      entry.close = str(e.close, 20, `${row}: Closing time`, true);
    }
    const note = str(e.note, 140, `${row}: Note`);
    if (note) entry.note = note;
    return entry;
  });

  return raw.pages
    .filter((p) => p.hours?.length)
    .map((p) => (tx, rev) =>
      tx.patch(p._id, (patch) =>
        patch.ifRevisionId(rev(p._id)).set(Object.fromEntries(p.hours!.map((h) => [`content${keyed(h._key)}.hours`, entries]))),
      ),
    );
}

function announcementPatches(raw: Raw, data: { text: string }): Patch[] {
  if (!raw.nav) throw new Refusal('The site has no header settings to change.');
  if (blocksToLines(raw.nav.grandOpeningMessage) === null) throw new Refusal('This message has formatting only the Studio can edit.');
  const lines = str(data.text, 400, 'The message').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 3) throw new Refusal('Keep the header message to 3 lines or fewer.');
  const nav = raw.nav;
  return [(tx, rev) => tx.patch(nav._id, (p) => p.ifRevisionId(rev(nav._id)).set({ grandOpeningMessage: linesToBlocks(lines.join('\n')) }))];
}

async function salePatches(raw: Raw, data: SaleSave): Promise<Patch[]> {
  const page = raw.pages.find((p) => p.sale);
  if (!page?.sale) throw new Refusal('There is no sale page set up to edit.');
  const sectionPath = `content${keyed(page.sale._key)}`;
  const set: Record<string, unknown> = {
    [`${sectionPath}.heading`]: str(data.heading, 160, 'The heading', true),
  };
  const unset: string[] = [];

  if (data.body !== null) {
    const body = fromMarkup(str(data.body, 5000, 'The sale text'));
    if (body.length) set[`${sectionPath}.body`] = body;
    else unset.push(`${sectionPath}.body`);
  } else if (toMarkup(page.sale.body) !== null) {
    throw new Refusal('The sale text was missing from the save. Reload and try again.');
  }

  let hasImage = Boolean(page.sale.imageUrl);
  if (data.image === 'remove') {
    unset.push(`${sectionPath}.image`);
    hasImage = false;
  } else if (data.image) {
    const m = data.image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m || !IMAGE_TYPES.includes(m[1])) throw new Refusal('The picture must be a JPEG, PNG or WebP image.');
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) throw new Refusal('That picture is too large. Try a smaller one (under 4 MB).');
    const asset = await client.assets.upload('image', bytes, {
      contentType: m[1],
      filename: `sale-${new Date().toISOString().slice(0, 10)}.${m[1].split('/')[1]}`,
    });
    set[`${sectionPath}.image`] = { _type: 'image', asset: { _type: 'reference', _ref: asset._id } };
    hasImage = true;
  }

  const altText = str(data.altText, 300, 'The picture description');
  if (hasImage && !altText) throw new Refusal('Add a short description of the picture for people who can’t see it.');
  if (altText) set[`${sectionPath}.altText`] = altText;
  else unset.push(`${sectionPath}.altText`);

  const patches: Patch[] = [
    (tx, rev) => tx.patch(page._id, (p) => {
      let next = p.ifRevisionId(rev(page._id)).set(set);
      if (unset.length) next = next.unset(unset);
      return next;
    }),
  ];

  const nav = raw.nav;
  const link = nav?.links?.find((l) => l.ref === page._id);
  const label = str(data.menuLabel, 30, 'The menu label') || page.title;
  if (nav && data.inMenu && !link) {
    patches.push((tx, rev) =>
      tx.patch(nav._id, (p) =>
        p.ifRevisionId(rev(nav._id)).setIfMissing({ links: [] }).insert('after', 'links[-1]', [
          { _key: key(), label, internalLink: { _type: 'reference', _ref: page._id } },
        ]),
      ),
    );
  } else if (nav && data.inMenu && link && link.label !== label) {
    patches.push((tx, rev) => tx.patch(nav._id, (p) => p.ifRevisionId(rev(nav._id)).set({ [`links${keyed(link._key)}.label`]: label })));
  } else if (nav && !data.inMenu && link) {
    patches.push((tx, rev) => tx.patch(nav._id, (p) => p.ifRevisionId(rev(nav._id)).unset([`links${keyed(link._key)}`])));
  }
  return patches;
}

function faqPatches(raw: Raw, data: { items: FaqItem[] }): Patch[] {
  const faq = raw.faq;
  if (!faq) throw new Refusal('The site has no FAQ page.');
  if (!Array.isArray(data.items)) throw new Refusal('No questions were sent.');
  if (data.items.length > 60) throw new Refusal('That is more questions than the FAQ page can hold (60 at most).');
  const current = new Map((faq.faqs ?? []).map((f) => [f._key, f]));

  const faqs = data.items.map((item, i) => {
    const label = `Question ${i + 1}`;
    const question = str(item.question, 200, label, true);
    const existing = item._key ? current.get(item._key) : undefined;
    let answer: Block[];
    if (item.answer === null) {
      // Formatting the dashboard can't edit: keep the Studio's version as is.
      if (!existing?.answer) throw new Refusal(`${label}: its answer is missing. Reload and try again.`);
      answer = existing.answer;
    } else {
      answer = fromMarkup(str(item.answer, 5000, `${label}: Answer`, true));
    }
    return { _type: existing?._type ?? 'faqItem', _key: keepKey(item._key), question, answer };
  });

  return [(tx, rev) => tx.patch(faq._id, (p) => p.ifRevisionId(rev(faq._id)).set({ faqs }))];
}

function contactPatches(raw: Raw, data: { phone: string; email: string }): Patch[] {
  const phone = str(data.phone, 30, 'Phone number', true);
  if (!/^\+?[0-9\s\-().]+$/.test(phone) || phone.replace(/\D/g, '').length < 10) throw new Refusal('That doesn’t look like a phone number.');
  const email = str(data.email, 120, 'Email address', true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refusal('That doesn’t look like an email address.');

  const patches: Patch[] = [];
  const footer = raw.footer;
  if (footer?.contactInfo) {
    patches.push((tx, rev) => tx.patch(footer._id, (p) => p.ifRevisionId(rev(footer._id)).set({ 'contactInfo.phone': phone, 'contactInfo.email': email })));
  }
  for (const page of raw.pages) {
    const set: Record<string, string> = {};
    for (const section of page.contacts ?? []) {
      for (const item of section.items ?? []) {
        const base = `content${keyed(section._key)}.contacts${keyed(item._key)}`;
        set[`${base}.phone`] = phone;
        set[`${base}.email`] = email;
      }
    }
    for (const section of page.cards ?? []) {
      for (const card of section.items ?? []) {
        const base = `content${keyed(section._key)}.contactCards${keyed(card._key)}`;
        if (card._type === 'phoneCard') set[`${base}.number`] = phone;
        if (card._type === 'emailCard') set[`${base}.address`] = email;
      }
    }
    if (Object.keys(set).length) patches.push((tx, rev) => tx.patch(page._id, (p) => p.ifRevisionId(rev(page._id)).set(set)));
  }
  return patches;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handler(event: { httpMethod: string; headers: Record<string, string>; body: string | null }) {
  const auth = await requireUser(event);
  if ('statusCode' in auth) return auth;
  if (!projectId || !token) return json(500, { error: 'Website editing is not configured (NETLIFY_SANITY_PROJECT_ID / SANITY_WRITE_TOKEN).' });

  try {
    if (event.httpMethod === 'GET') return json(200, await view(await load()));
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    let payload: SavePayload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }
    if (!SECTIONS.includes(payload.section)) return json(400, { error: 'Unknown section.' });

    const raw = await load();
    const current = await view(raw);
    const blocker = current.blocked[payload.section];
    if (blocker) {
      throw new Refusal(
        `The ${blocker} has unpublished changes in the Studio. Publish or discard them there first, then save here again.`,
        409,
      );
    }

    const patches =
      payload.section === 'hours' ? hoursPatches(raw, payload.data)
      : payload.section === 'announcement' ? announcementPatches(raw, payload.data)
      : payload.section === 'sale' ? await salePatches(raw, payload.data)
      : payload.section === 'faqs' ? faqPatches(raw, payload.data)
      : contactPatches(raw, payload.data);
    if (!patches.length) throw new Refusal('There was nothing on the website to update.');

    const rev = (id: string) => {
      const r = payload.revs?.[id];
      if (!r) throw new Refusal('This page is out of date. Reload it and try again.', 409);
      return r;
    };
    const tx = client.transaction();
    for (const patch of patches) patch(tx, rev);
    await tx.commit({ visibility: 'sync' });

    console.log(`site-content: ${auth.email ?? 'user'} saved ${payload.section}`);
    return json(200, await view(await load()));
  } catch (err) {
    if (err instanceof Refusal) return json(err.status, { error: err.message });
    // Sanity answers 409 for a revision mismatch and for other conflicts alike;
    // only the first means someone else changed it.
    const description = String((err as { details?: { description?: string } }).details?.description ?? (err as Error).message ?? '');
    if (/unexpected revision ID/i.test(description)) {
      return json(409, { error: 'This was changed in the Studio after you opened it. Reload to see the latest, then make your change again.' });
    }
    console.error('site-content error:', err);
    return json(500, { error: 'Could not save to the website. Please try again.' });
  }
}
