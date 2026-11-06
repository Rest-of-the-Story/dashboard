/**
 * Sanity rich text (Portable Text) <-> the light markup the dashboard's text
 * boxes use, so the client can edit FAQ answers and the sale text without the
 * Studio and without losing the bold and lists already there.
 *
 *   **bold**   *italic*   [link text](https://…)
 *   - bullet item          1. numbered item
 *   a blank line starts a new paragraph; a single line break stays a line
 *   break (the site shows it as one, e.g. the "•" lines some FAQ answers use)
 *
 * toMarkup returns null for anything this can't represent faithfully
 * (headings, quotes, nested lists, embeds, other marks); the editor then shows
 * that text read-only with a link to the Studio rather than flattening it.
 */

export interface Span { _type: 'span'; _key?: string; text: string; marks?: string[] }
export interface MarkDef { _type: string; _key: string; href?: string }
export interface Block {
  _type: string;
  _key?: string;
  style?: string;
  listItem?: string;
  level?: number;
  markDefs?: MarkDef[];
  children?: Span[];
}

const DECORATORS: Record<string, string> = { strong: '**', em: '*' };

/**
 * Backslash only what would otherwise be read as markup: a * touching a word,
 * a [ when the text has "](", and a backslash before either. "5 * 3" stays as is.
 */
function escape(text: string): string {
  const linkish = text.includes('](');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = text[i - 1] ?? ' ';
    const next = text[i + 1] ?? ' ';
    if (ch === '*') {
      // Judge a run of stars as one: "2 ** 3" is plain, "**x" is not.
      let end = i;
      while (text[end + 1] === '*') end++;
      const free = /\s/.test(prev) && /\s/.test(text[end + 1] ?? ' ');
      out += free ? text.slice(i, end + 1) : '\\*'.repeat(end - i + 1);
      i = end;
    }
    else if (ch === '[' && linkish) out += '\\[';
    else if (ch === '\\' && /[*[\\]/.test(next)) out += '\\\\';
    else out += ch;
  }
  return out;
}

const isEmpty = (b: Block) => !b.listItem && (b.children ?? []).every((c) => !c.text.trim());

function spansToMarkup(block: Block): string | null {
  const defs = new Map((block.markDefs ?? []).map((d) => [d._key, d]));
  // Merge neighbours with identical marks so "**a****b**" never appears.
  const merged: { text: string; marks: string[] }[] = [];
  for (const child of block.children ?? []) {
    if (child._type !== 'span') return null;
    const marks = [...(child.marks ?? [])].sort();
    const prev = merged[merged.length - 1];
    if (prev && prev.marks.join() === marks.join()) prev.text += child.text;
    else merged.push({ text: child.text, marks });
  }

  let out = '';
  for (const { text, marks } of merged) {
    if (!text) continue;
    let link: string | undefined;
    const decorators: string[] = [];
    for (const mark of marks) {
      if (DECORATORS[mark]) decorators.push(DECORATORS[mark]);
      else if (defs.get(mark)?._type === 'link' && defs.get(mark)?.href && !link) link = defs.get(mark)!.href;
      else return null;
    }
    // Markers hug the words; surrounding spaces stay outside them.
    const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    if (!core) { out += text; continue; }
    decorators.sort().reverse(); // ** outside *
    let piece = escape(core);
    for (const d of [...decorators].reverse()) piece = `${d}${piece}${d}`;
    if (link) piece = `[${piece}](${link})`;
    out += lead + piece + trail;
  }
  return out;
}

export function toMarkup(blocks: Block[] | null | undefined): string | null {
  if (!blocks?.length) return '';
  const lines: string[] = [];
  let number = 0;
  for (const block of blocks) {
    if (block._type !== 'block') return null;
    if ((block.style ?? 'normal') !== 'normal') return null;
    if (block.listItem && (block.level ?? 1) !== 1) return null;
    if (block.listItem && !['bullet', 'number'].includes(block.listItem)) return null;
    if (isEmpty(block)) continue;

    const text = spansToMarkup(block);
    if (text === null) return null;
    if (block.listItem && text.includes('\n')) return null;
    // A paragraph line that looks like a list item would come back as one.
    if (!block.listItem && text.split('\n').some((l) => isList(l.trimStart()))) return null;

    if (block.listItem === 'number') lines.push(`${++number}. ${text}`);
    else {
      number = 0;
      lines.push(block.listItem === 'bullet' ? `- ${text}` : text);
    }
  }
  // A blank line between paragraphs reads naturally; list items stay together.
  return lines
    .map((line, i) => (i && !(isList(line) && isList(lines[i - 1]!)) ? `\n${line}` : line))
    .join('\n');
}

const isList = (line: string) => /^(- |\d+\. )/.test(line);

let keyCounter = 0;
const newKey = () => `${Date.now().toString(36)}${(keyCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Parses one line's inline markup into spans and link definitions. */
function parseInline(line: string): { children: Span[]; markDefs: MarkDef[] } {
  const children: Span[] = [];
  const markDefs: MarkDef[] = [];
  const active = new Set<string>();
  let linkKey: string | undefined;
  let text = '';

  const flush = () => {
    if (!text) return;
    const marks = [...active].sort();
    if (linkKey) marks.push(linkKey);
    children.push({ _type: 'span', _key: newKey(), text, marks });
    text = '';
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) { text += line[++i]; continue; }
    // *** toggles bold and italic together (toMarkup writes both marks that way).
    if (line.startsWith('***', i)) {
      const both = active.has('strong') && active.has('em');
      if (both || (!active.has('strong') && !active.has('em') && !/\s/.test(line[i + 3] ?? ' ') && /[^\s\\*]\*\*\*/.test(line.slice(i + 3)))) {
        flush();
        for (const m of ['strong', 'em']) both ? active.delete(m) : active.add(m);
        i += 2;
        continue;
      }
    }
    if (ch === '*') {
      const mark = line[i + 1] === '*' ? 'strong' : 'em';
      const width = mark === 'strong' ? 2 : 1;
      const marker = '*'.repeat(width);
      const before = line[i - 1] ?? ' ';
      const after = line[i + width] ?? ' ';
      if (active.has(mark) && !/\s/.test(before)) {
        flush();
        active.delete(mark);
        i += width - 1;
        continue;
      }
      // Opens only against a word and only if it closes later; otherwise "*" is text.
      const rest = line.slice(i + width);
      const closer = mark === 'strong' ? /[^\s\\]\*\*/ : /[^\s\\*]\*(?!\*)/;
      if (!active.has(mark) && !/\s/.test(after) && closer.test(rest)) {
        flush();
        active.add(mark);
        i += width - 1;
        continue;
      }
      text += marker;
      i += width - 1;
      continue;
    }
    if (ch === '[' && !linkKey) {
      const close = findLinkEnd(line, i);
      if (close) {
        flush();
        linkKey = newKey();
        markDefs.push({ _type: 'link', _key: linkKey, href: close.href });
        const inner = parseInline(line.slice(i + 1, close.textEnd));
        for (const span of inner.children) {
          children.push({ ...span, marks: [...new Set([...(span.marks ?? []), ...active])].sort().concat(linkKey) });
        }
        linkKey = undefined;
        i = close.end;
        continue;
      }
    }
    text += ch;
  }
  flush();
  if (!children.length) children.push({ _type: 'span', _key: newKey(), text: '', marks: [] });
  return { children, markDefs };
}

function findLinkEnd(line: string, start: number): { textEnd: number; href: string; end: number } | null {
  let depth = 0;
  for (let j = start; j < line.length; j++) {
    if (line[j] === '\\') { j++; continue; }
    if (line[j] === '[') depth++;
    if (line[j] === ']' && --depth === 0) {
      const m = line.slice(j + 1).match(/^\(([^)\s]+)\)/);
      const href = m?.[1];
      if (!m || !href || !/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) return null;
      return { textEnd: j, href, end: j + m[0].length };
    }
  }
  return null;
}

export function fromMarkup(markup: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const push = (body: string, listItem?: 'bullet' | 'number') =>
    blocks.push({
      _type: 'block',
      _key: newKey(),
      style: 'normal',
      ...(listItem ? { listItem, level: 1 } : {}),
      ...parseInline(body),
    });
  const endParagraph = () => {
    const text = paragraph.join('\n').trim();
    if (text) push(text);
    paragraph = [];
  };

  for (const raw of markup.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*-\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) endParagraph();
    else if (bullet || numbered) {
      endParagraph();
      push((bullet?.[1] ?? numbered?.[1])!.trim(), bullet ? 'bullet' : 'number');
    } else {
      paragraph.push(line);
    }
  }
  endParagraph();
  return blocks;
}

/** Plain lines (no markup), for one-line fields such as the header message. */
export function linesToBlocks(text: string): Block[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({
      _type: 'block',
      _key: newKey(),
      style: 'normal',
      markDefs: [],
      children: [{ _type: 'span' as const, _key: newKey(), text: line, marks: [] }],
    }));
}

/** Plain lines, or null when the blocks carry formatting a plain box would drop. */
export function blocksToLines(blocks: Block[] | null | undefined): string | null {
  const lines: string[] = [];
  for (const b of blocks ?? []) {
    if (b._type !== 'block' || (b.style ?? 'normal') !== 'normal' || b.listItem) return null;
    if ((b.children ?? []).some((c) => c._type !== 'span' || c.marks?.length)) return null;
    const text = (b.children ?? []).map((c) => c.text).join('').trim();
    if (text) lines.push(text);
  }
  return lines.join('\n');
}
