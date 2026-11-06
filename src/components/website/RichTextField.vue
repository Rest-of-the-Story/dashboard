<script setup lang="ts">
import { computed, ref } from 'vue';
import { Bold, Italic, List, ListOrdered, Link2 } from 'lucide-vue-next';
import { fromMarkup, type Block } from '@/lib/richText';

/**
 * A text box for formatted text: Bold, Italic, lists and links via buttons
 * (they insert the light markup src/lib/richText.ts reads), with a preview of
 * how it will look on the website underneath.
 */
const model = defineModel<string>({ required: true });
const props = defineProps<{ id: string; label: string; rows?: number; hint?: string }>();

const box = ref<HTMLTextAreaElement | null>(null);
// Grow with the text (long lines wrap, so allow a little extra), up to a point.
const boxRows = computed(() => {
  const lines = model.value.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 90)), 0);
  return Math.min(16, Math.max(props.rows ?? 5, lines + 1));
});
const showPreview = computed(() => /[*[\n]|^\s*(-|\d+\.)\s/m.test(model.value));
const preview = computed<Block[]>(() => fromMarkup(model.value));

function replaceSelection(make: (selected: string) => { text: string; select?: [number, number] }) {
  const el = box.value;
  if (!el) return;
  const { selectionStart: start, selectionEnd: end, value } = el;
  const { text, select } = make(value.slice(start, end));
  model.value = value.slice(0, start) + text + value.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    const [a, b] = select ?? [text.length, text.length];
    el.setSelectionRange(start + a, start + b);
  });
}

function wrap(marker: string, placeholder: string) {
  replaceSelection((sel) => {
    const word = sel.trim() || placeholder;
    const lead = sel.match(/^\s*/)![0];
    const trail = sel.match(/\s*$/)![0];
    return { text: `${lead}${marker}${word}${marker}${trail}`, select: [lead.length + marker.length, lead.length + marker.length + word.length] };
  });
}

function list(numbered: boolean) {
  const el = box.value;
  if (!el) return;
  // Work on whole lines, so the selection doesn't have to start at the line's edge.
  const value = el.value;
  const lineStart = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
  const nextBreak = value.indexOf('\n', el.selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  el.setSelectionRange(lineStart, lineEnd);
  replaceSelection((sel) => {
    const lines = (sel || 'List item').split('\n');
    const text = lines.map((l, i) => `${numbered ? `${i + 1}.` : '-'} ${l.replace(/^\s*(-|\d+[.)])\s+/, '')}`).join('\n');
    return { text };
  });
}

function link() {
  replaceSelection((sel) => {
    const words = sel.trim() || 'link text';
    const text = `[${words}](https://)`;
    // Leave the cursor where the address goes.
    return { text, select: [words.length + 3, text.length - 1] };
  });
}

const hrefOf = (block: Block, mark: string) => block.markDefs?.find((d) => d._key === mark)?.href;
const isSafeHref = (href?: string) => Boolean(href && /^(https?:\/\/|mailto:|tel:|\/)/i.test(href));

/** Groups list items so the preview renders real lists. */
const groups = computed(() => {
  const out: { list?: 'bullet' | 'number'; blocks: Block[] }[] = [];
  for (const b of preview.value) {
    const kind = b.listItem as 'bullet' | 'number' | undefined;
    const last = out[out.length - 1];
    if (kind && last?.list === kind) last.blocks.push(b);
    else out.push({ list: kind, blocks: [b] });
  }
  return out;
});
</script>

<template>
  <div class="rt">
    <label :for="id" class="field__label">{{ label }}</label>
    <div class="rt__tools" role="toolbar" :aria-label="`Formatting for ${label}`">
      <button type="button" title="Bold" aria-label="Bold" @click="wrap('**', 'bold text')"><Bold :size="15" /></button>
      <button type="button" title="Italic" aria-label="Italic" @click="wrap('*', 'italic text')"><Italic :size="15" /></button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" @click="list(false)"><List :size="15" /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" @click="list(true)"><ListOrdered :size="15" /></button>
      <button type="button" title="Link" aria-label="Link" @click="link"><Link2 :size="15" /></button>
    </div>
    <textarea :id="id" ref="box" v-model="model" class="field__input rt__box" :rows="boxRows" :aria-describedby="`${id}-hint`" />
    <p :id="`${id}-hint`" class="field__hint">
      {{ hint ? `${hint} ` : '' }}Select words and press a button to format them. A blank line starts a new paragraph.
    </p>

    <div v-if="showPreview" class="rt__preview" :aria-label="`Preview of ${label}`">
      <p class="rt__preview-label">How it will look</p>
      <template v-for="(g, gi) in groups" :key="gi">
        <component :is="g.list === 'number' ? 'ol' : 'ul'" v-if="g.list">
          <li v-for="b in g.blocks" :key="b._key">
            <template v-for="c in b.children" :key="c._key">
              <component
                :is="(c.marks ?? []).some((m) => isSafeHref(hrefOf(b, m))) ? 'a' : 'span'"
                :href="(c.marks ?? []).map((m) => hrefOf(b, m)).find(isSafeHref)"
                :class="{ 'rt__b': c.marks?.includes('strong'), 'rt__i': c.marks?.includes('em') }"
                target="_blank" rel="noopener noreferrer"
              >{{ c.text }}</component>
            </template>
          </li>
        </component>
        <template v-else>
          <p v-for="b in g.blocks" :key="b._key" class="rt__p">
            <template v-for="c in b.children" :key="c._key">
              <component
                :is="(c.marks ?? []).some((m) => isSafeHref(hrefOf(b, m))) ? 'a' : 'span'"
                :href="(c.marks ?? []).map((m) => hrefOf(b, m)).find(isSafeHref)"
                :class="{ 'rt__b': c.marks?.includes('strong'), 'rt__i': c.marks?.includes('em') }"
                target="_blank" rel="noopener noreferrer"
              >{{ c.text }}</component>
            </template>
          </p>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rt__tools { display: flex; gap: 0.25rem; margin-bottom: 0.35rem; }
.rt__tools button {
  display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem;
  color: var(--color-text); background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--border-radius); cursor: pointer;
}
.rt__tools button:hover { border-color: var(--color-text-secondary); }
.rt__box { font-family: var(--font-body); line-height: 1.55; resize: vertical; }

.rt__preview {
  margin-top: 0.75rem; padding: 0.75rem 1rem; font-size: 0.9375rem; line-height: 1.6;
  background: var(--color-bg); border-radius: var(--border-radius);
}
.rt__preview-label {
  margin: 0 0 0.35rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--color-text-secondary);
}
.rt__p { margin: 0 0 0.6rem; white-space: pre-line; }
.rt__preview ul, .rt__preview ol { margin: 0 0 0.6rem; padding-left: 1.25rem; }
.rt__preview ul { list-style: disc; }
.rt__preview ol { list-style: decimal; }
.rt__preview a { color: var(--color-primary); text-decoration: underline; }
.rt__b { font-weight: 700; }
.rt__i { font-style: italic; }
</style>
