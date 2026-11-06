<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { HelpCircle, Plus, ArrowUp, ArrowDown, Trash2, ChevronDown } from 'lucide-vue-next';
import EditCard from './EditCard.vue';
import RichTextField from './RichTextField.vue';
import type { FaqItem } from '@/types/siteContent';

const props = defineProps<{
  items: FaqItem[];
  blocked?: string;
  studioUrl?: string;
  save: (data: { items: FaqItem[] }) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'dirty', value: boolean): void }>();

type Row = FaqItem & { id: string };
let counter = 0;
const toRows = (items: FaqItem[]): Row[] => items.map((f) => ({ ...f, id: f._key ?? `new-${counter++}` }));

const rows = ref<Row[]>(toRows(props.items));
const open = ref<string | null>(null);
const strip = (list: FaqItem[]) => JSON.stringify(list.map(({ _key, question, answer }) => ({ _key, question, answer })));
const dirty = computed(() => strip(rows.value) !== strip(props.items));

watch(() => props.items, (items) => (rows.value = toRows(items)));
watch(dirty, (d) => emit('dirty', d), { immediate: true });

const preview = (a: string | null) => (a === null ? 'Formatted answer (edit in the Studio)' : a.replace(/[*[\]]|\(https?:[^)]*\)/g, '').slice(0, 110));

async function add() {
  const row: Row = { _key: undefined, question: '', answer: '', id: `new-${counter++}` };
  rows.value.push(row);
  open.value = row.id;
  await nextTick();
  document.getElementById(`faq-q-${row.id}`)?.focus();
}
function move(i: number, by: number) {
  const [row] = rows.value.splice(i, 1);
  if (row) rows.value.splice(i + by, 0, row);
}
function remove(i: number) {
  const q = rows.value[i]?.question.trim();
  if (q && !confirm(`Remove "${q}" from the FAQ page?`)) return;
  rows.value.splice(i, 1);
}

async function save() {
  await props.save({ items: rows.value.map(({ _key, question, answer }) => ({ _key, question, answer })) });
}
</script>

<template>
  <EditCard
    id="faqs" title="Frequently asked questions" :icon="HelpCircle"
    :where="`Your FAQ page: ${items.length} questions about consigning, fees and drop-off.`"
    :dirty="dirty" :save="save" :blocked="blocked" :studio-url="studioUrl" @reset="rows = toRows(items)"
  >
    <ol class="faq">
      <li v-for="(row, i) in rows" :key="row.id" class="faq__item" :class="{ 'faq__item--open': open === row.id }">
        <div class="faq__head">
          <button
            type="button" class="faq__toggle" :aria-expanded="open === row.id" :aria-controls="`faq-body-${row.id}`"
            @click="open = open === row.id ? null : row.id"
          >
            <span class="faq__q">{{ row.question || 'New question' }}</span>
            <span v-if="open !== row.id" class="faq__a">{{ preview(row.answer) }}</span>
            <ChevronDown :size="16" class="faq__chev" aria-hidden="true" />
          </button>
          <div class="faq__tools">
            <button type="button" class="btn btn--quiet btn--small" :disabled="i === 0" :aria-label="`Move question ${i + 1} up`" @click="move(i, -1)"><ArrowUp :size="15" /></button>
            <button type="button" class="btn btn--quiet btn--small" :disabled="i === rows.length - 1" :aria-label="`Move question ${i + 1} down`" @click="move(i, 1)"><ArrowDown :size="15" /></button>
            <button type="button" class="btn btn--quiet btn--small" :aria-label="`Remove question ${i + 1}`" @click="remove(i)"><Trash2 :size="15" /></button>
          </div>
        </div>
        <div v-if="open === row.id" :id="`faq-body-${row.id}`" class="faq__body">
          <label class="field">
            <span class="field__label">Question</span>
            <input :id="`faq-q-${row.id}`" v-model="row.question" class="field__input" type="text" maxlength="200" />
          </label>
          <RichTextField v-if="row.answer !== null" :id="`faq-a-${row.id}`" :model-value="row.answer" @update:model-value="(v: string) => (row.answer = v)" label="Answer" :rows="5" />
          <p v-else class="card__empty">
            This answer has formatting the dashboard can't edit without losing it, so it's kept exactly as it is. Change it in the Studio.
          </p>
        </div>
      </li>
    </ol>
    <button type="button" class="btn btn--small faq__add" @click="add"><Plus :size="14" aria-hidden="true" /> Add a question</button>
  </EditCard>
</template>

<style scoped>
.faq { list-style: none; margin: 0; padding: 0; border: 1px solid var(--color-border); border-radius: var(--border-radius); }
.faq__item + .faq__item { border-top: 1px solid var(--color-border); }
.faq__item--open { background: color-mix(in srgb, var(--color-bg) 60%, transparent); }
.faq__head { display: flex; align-items: flex-start; gap: 0.25rem; }
.faq__toggle {
  flex: 1; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.15rem 0.5rem;
  padding: 0.75rem 0.9rem; text-align: left; background: none; border: 0; cursor: pointer; color: var(--color-text); font: inherit;
}
.faq__q { font-weight: 600; font-size: 0.9375rem; }
.faq__a { grid-column: 1; font-size: 0.8125rem; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.faq__chev { grid-column: 2; grid-row: 1; margin-top: 0.2rem; color: var(--color-text-secondary); }
.faq__item--open .faq__chev { transform: rotate(180deg); }
.faq__tools { display: flex; padding: 0.5rem 0.4rem 0 0; }
.faq__body { display: flex; flex-direction: column; gap: 0.9rem; padding: 0.25rem 0.9rem 1rem; }
.faq__add { margin-top: 0.85rem; }
@media (max-width: 520px) {
  .faq__head { flex-direction: column; align-items: stretch; }
  .faq__tools { justify-content: flex-end; padding: 0 0.4rem 0.4rem; margin-top: -0.5rem; }
}
</style>
