<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Clock, Plus, CalendarX, ArrowUp, ArrowDown, Trash2, Info } from 'lucide-vue-next';
import EditCard from './EditCard.vue';
import type { HoursEntry, SiteContent } from '@/types/siteContent';

const props = defineProps<{
  hours: NonNullable<SiteContent['hours']>;
  blocked?: string;
  studioUrl?: string;
  save: (data: { entries: HoursEntry[] }) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'dirty', value: boolean): void }>();

const clean = (list: HoursEntry[]) =>
  list.map((e) => ({ _key: e._key, days: e.days ?? '', closed: Boolean(e.closed), open: e.open ?? '', close: e.close ?? '', note: e.note ?? '' }));

const rows = ref(clean(props.hours.entries));
const original = computed(() => JSON.stringify(clean(props.hours.entries)));
const dirty = computed(() => JSON.stringify(rows.value) !== original.value);

watch(() => props.hours, (h) => (rows.value = clean(h.entries)));
watch(dirty, (d) => emit('dirty', d), { immediate: true });

const where = computed(() => {
  const pages = props.hours.pages;
  return `Shown on the ${pages.length > 1 ? `${pages.slice(0, -1).join(', ')} and ${pages[pages.length - 1]}` : pages[0]} page${pages.length > 1 ? 's' : ''}. Saving updates ${pages.length > 1 ? 'all of them' : 'it'}.`;
});

function add(closed: boolean) {
  rows.value.push({ _key: undefined, days: '', closed, open: closed ? '' : '10am', close: closed ? '' : '5:30pm', note: '' });
}
function move(i: number, by: number) {
  const [row] = rows.value.splice(i, 1);
  if (row) rows.value.splice(i + by, 0, row);
}

async function save() {
  await props.save({ entries: rows.value.map((r) => ({ ...r, open: r.closed ? undefined : r.open, close: r.closed ? undefined : r.close })) });
}
</script>

<template>
  <EditCard
    id="hours" title="Store hours & closures" :icon="Clock" :where="where"
    :dirty="dirty" :save="save" :blocked="blocked" :studio-url="studioUrl" @reset="rows = clean(hours.entries)"
  >
    <div v-if="hours.differs" class="hours__notice">
      <Info :size="16" aria-hidden="true" />
      <p>Those pages show slightly different hours right now. This list is the Contact page's; saving makes the others match it.</p>
    </div>

    <ol class="hours">
      <li v-for="(row, i) in rows" :key="row._key ?? `new-${i}`" class="hours__row" :class="{ 'hours__row--closed': row.closed }">
        <label class="field hours__days">
          <span class="field__label">Days</span>
          <input v-model="row.days" class="field__input" type="text" maxlength="60" :placeholder="row._key ? '' : row.closed ? 'e.g. Thanksgiving, Nov 26' : 'e.g. Tuesday - Friday'" />
        </label>
        <label class="hours__closed">
          <input v-model="row.closed" type="checkbox" /> Closed
        </label>
        <template v-if="!row.closed">
          <label class="field hours__open">
            <span class="field__label">Opens</span>
            <input v-model="row.open" class="field__input" type="text" maxlength="20" placeholder="10am" />
          </label>
          <label class="field hours__close">
            <span class="field__label">Closes</span>
            <input v-model="row.close" class="field__input" type="text" maxlength="20" placeholder="5:30pm" />
          </label>
        </template>
        <label class="field hours__note">
          <span class="field__label">Note <em>(optional)</em></span>
          <input v-model="row.note" class="field__input" type="text" maxlength="140" :placeholder="row._key ? '' : row.closed ? 'e.g. Happy Thanksgiving!' : 'e.g. Closed 12–1:30 for staff prayer'" />
        </label>
        <div class="hours__tools">
          <button type="button" class="btn btn--quiet btn--small" :disabled="i === 0" :aria-label="`Move ${row.days || 'row'} up`" @click="move(i, -1)"><ArrowUp :size="15" /></button>
          <button type="button" class="btn btn--quiet btn--small" :disabled="i === rows.length - 1" :aria-label="`Move ${row.days || 'row'} down`" @click="move(i, 1)"><ArrowDown :size="15" /></button>
          <button type="button" class="btn btn--quiet btn--small" :aria-label="`Remove ${row.days || 'row'}`" @click="rows.splice(i, 1)"><Trash2 :size="15" /></button>
        </div>
      </li>
    </ol>

    <div class="hours__add">
      <button type="button" class="btn btn--small" @click="add(false)"><Plus :size="14" aria-hidden="true" /> Add hours</button>
      <button type="button" class="btn btn--small" @click="add(true)"><CalendarX :size="14" aria-hidden="true" /> Add a holiday or closure</button>
    </div>
    <p class="field__hint">Remove a holiday once it's passed. Hours are shown just as you type them, so "10am" and "10:00 AM" both work.</p>
  </EditCard>
</template>

<style scoped>
.hours__notice {
  display: flex; gap: 0.5rem; align-items: flex-start; margin-bottom: 1rem; padding: 0.65rem 0.9rem;
  font-size: 0.875rem; line-height: 1.5; background: var(--color-bg); border-radius: var(--border-radius);
}
.hours__notice p { margin: 0; }
.hours__notice svg { flex-shrink: 0; margin-top: 0.15rem; color: var(--color-info); }

.hours { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.hours__row {
  display: grid; gap: 0.6rem 0.75rem; align-items: end; padding: 0.85rem;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: 'days days' 'open close' 'note note' 'closed tools';
  border: 1px solid var(--color-border); border-radius: var(--border-radius);
}
.hours__row--closed { grid-template-areas: 'days days' 'note note' 'closed tools'; background: var(--color-bg); }
.hours__days { grid-area: days; }
.hours__closed { grid-area: closed; display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.2rem; font-size: 0.875rem; font-weight: 600; white-space: nowrap; }
.hours__open { grid-area: open; }
.hours__close { grid-area: close; }
.hours__note { grid-area: note; }
.hours__tools { grid-area: tools; display: flex; justify-content: flex-end; gap: 0.15rem; margin: -0.25rem -0.4rem -0.4rem 0; }

@media (min-width: 900px) {
  .hours__row {
    grid-template-columns: minmax(9rem, 1.3fr) 5.5rem 5.5rem minmax(9rem, 1.6fr) auto auto;
    grid-template-areas: 'days open close note closed tools';
  }
  .hours__row--closed { grid-template-areas: 'days note note note closed tools'; }
  .hours__tools { margin: 0 -0.4rem 0 0; padding-bottom: 0.2rem; }
  .hours__closed { padding-bottom: 0.6rem; }
}

.hours__add { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.85rem; }
</style>
