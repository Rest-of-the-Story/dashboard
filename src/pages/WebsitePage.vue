<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ExternalLink } from 'lucide-vue-next';
import DashboardLayout from '@/components/layout/DashboardLayout.vue';
import HoursCard from '@/components/website/HoursCard.vue';
import AnnouncementCard from '@/components/website/AnnouncementCard.vue';
import SaleCard from '@/components/website/SaleCard.vue';
import FaqCard from '@/components/website/FaqCard.vue';
import ContactCard from '@/components/website/ContactCard.vue';
import { useSiteContent } from '@/composables/useSiteContent';
import config from '@/config/dashboard';
import type { Section } from '@/types/siteContent';

/**
 * Edit Website: the things the shop changes most, saved straight to the CMS
 * (netlify/functions/site-content.ts). Everything else stays in the Studio.
 */
const { content, loading, loadError, load, save } = useSiteContent();
const studioUrl = config.links.find((l) => /studio/i.test(l.label))?.url;
const siteUrl = `https://${config.clientDomain}`;

const dirty = reactive<Partial<Record<Section, boolean>>>({});
const anyDirty = computed(() => Object.values(dirty).some(Boolean));

const warnOnUnload = (e: BeforeUnloadEvent) => {
  if (anyDirty.value) e.preventDefault();
};
onMounted(() => {
  load();
  window.addEventListener('beforeunload', warnOnUnload);
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnOnUnload));
onBeforeRouteLeave(() => !anyDirty.value || confirm('You have changes that aren’t saved yet. Leave without saving?'));
</script>

<template>
  <DashboardLayout page-title="Edit Website">
    <div class="website">
      <p class="website__intro">
        Change the things that come up most, right here. Each section saves on its own and shows on
        <a :href="siteUrl" target="_blank" rel="noopener noreferrer">your website<span class="sr-only"> (opens in a new tab)</span></a>
        within a minute. Photos, page text and blog posts are edited in the
        <a v-if="studioUrl" :href="studioUrl" target="_blank" rel="noopener noreferrer">Studio <ExternalLink :size="12" aria-hidden="true" /><span class="sr-only"> (opens in a new tab)</span></a><template v-else>Studio</template>.
      </p>

      <p v-if="loading" class="card card__empty" role="status">Loading your website content…</p>
      <div v-else-if="loadError" class="card website__error" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="btn btn--small" @click="load">Try again</button>
      </div>

      <template v-else-if="content">
        <HoursCard
          v-if="content.hours" :hours="content.hours" :blocked="content.blocked.hours" :studio-url="content.studio.hours"
          :save="(d) => save('hours', d)" @dirty="dirty.hours = $event"
        />
        <AnnouncementCard
          v-if="content.announcement" :text="content.announcement.text" :blocked="content.blocked.announcement"
          :studio-url="content.studio.announcement" :save="(d) => save('announcement', d)" @dirty="dirty.announcement = $event"
        />
        <SaleCard
          v-if="content.sale" :sale="content.sale" :blocked="content.blocked.sale" :studio-url="content.studio.sale"
          :save="(d) => save('sale', d)" @dirty="dirty.sale = $event"
        />
        <FaqCard
          v-if="content.faqs" :items="content.faqs.items" :blocked="content.blocked.faqs" :studio-url="content.studio.faqs"
          :save="(d) => save('faqs', d)" @dirty="dirty.faqs = $event"
        />
        <ContactCard
          v-if="content.contact" :contact="content.contact" :blocked="content.blocked.contact" :studio-url="content.studio.contact"
          :save="(d) => save('contact', d)" @dirty="dirty.contact = $event"
        />
      </template>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.website { max-width: 960px; display: flex; flex-direction: column; gap: 1.25rem; }
.website__intro { margin: 0; font-size: 0.9375rem; line-height: 1.6; color: var(--color-text-secondary); }
.website__intro a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
.website__error { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; color: var(--color-danger); }
.website__error p { margin: 0; }
</style>
