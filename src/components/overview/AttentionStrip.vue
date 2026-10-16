<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Receipt, CheckCircle2 } from 'lucide-vue-next';
import type { PendingCharge } from '@/composables/useOverview';

const props = defineProps<{
  charges: PendingCharge[];
  loaded: boolean;
}>();

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

/**
 * Only things someone should act on; anything informational lives further
 * down. Unpaid invoices for now; new website messages join them once the
 * submissions inbox exists.
 */
const items = computed(() =>
  props.charges.map((charge) => {
    const due = charge.dueDate
      ? ` due ${new Date(charge.dueDate * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : '';
    return { key: charge.id, text: `Invoice for ${money(charge.amount, charge.currency)}${due}`, action: 'View', to: '/billing' };
  })
);
</script>

<template>
  <section aria-label="Needs your attention">
    <ul v-if="items.length" class="attn">
      <li v-for="item in items" :key="item.key">
        <RouterLink :to="item.to" class="attn__item">
          <span class="attn__icon"><Receipt :size="18" aria-hidden="true" /></span>
          <span class="attn__text">{{ item.text }}</span>
          <span class="attn__action">{{ item.action }} &rarr;</span>
        </RouterLink>
      </li>
    </ul>
    <p v-else-if="loaded" class="attn__clear">
      <CheckCircle2 :size="18" aria-hidden="true" /> All caught up — nothing is waiting on you.
    </p>
  </section>
</template>

<style scoped>
.attn { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 0.75rem; }
.attn__item {
  display: flex; align-items: center; gap: 0.75rem; height: 100%; padding: 0.85rem 1rem;
  background-color: var(--color-surface); border: 1px solid var(--color-border); border-left: 4px solid var(--color-accent);
  border-radius: calc(var(--border-radius) * 1.5); box-shadow: var(--shadow-card); color: var(--color-text);
  transition: border-color 0.15s ease;
}
.attn__item:hover { border-color: var(--color-primary); }
.attn__icon {
  display: grid; place-items: center; width: 2.25rem; height: 2.25rem; flex-shrink: 0; border-radius: 50%;
  background-color: var(--color-bg); color: var(--color-primary);
}
.attn__text { flex: 1; font-size: 0.9375rem; font-weight: 600; }
.attn__action { font-size: 0.8125rem; font-weight: 600; color: var(--color-primary); white-space: nowrap; }
.attn__clear { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; color: var(--color-up); font-weight: 600; }
</style>
