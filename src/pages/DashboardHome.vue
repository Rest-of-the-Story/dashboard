<script setup lang="ts">
import { computed, onMounted } from 'vue';
import DashboardLayout from '@/components/layout/DashboardLayout.vue';
import OverviewGreeting from '@/components/overview/OverviewGreeting.vue';
import AttentionStrip from '@/components/overview/AttentionStrip.vue';
import MonthToDate from '@/components/overview/MonthToDate.vue';
import SiteHealth from '@/components/overview/SiteHealth.vue';
import MonthlyReportWidget from '@/components/widgets/MonthlyReportWidget.vue';
import TutorialsWidget from '@/components/widgets/TutorialsWidget.vue';
import ContentEditorWidget from '@/components/widgets/ContentEditorWidget.vue';
import { useOverview } from '@/composables/useOverview';
import config from '@/config/dashboard';

/**
 * The page the client lands on, read top to bottom (docs/OVERVIEW-STANDARD.md):
 *
 *   1. who it's for, and the things they came to do (greeting, quick actions)
 *   2. anything waiting on them (an unpaid invoice)
 *   3. how this month is going, live
 *   4. how last month went, settled (the monthly report)
 *   …with the site's health alongside.
 *
 * Latest website messages join the side column once the site saves its form
 * submissions. The Links and analytics widgets used to sit here; their content
 * now lives in the greeting's actions and the month-so-far card.
 */
const { month, monthState, charges, chargesLoaded, lighthouse, healthLoaded, load } = useOverview();

/** Optional extras; none are enabled for this client today. */
const extras = computed(() =>
  [
    config.enabledWidgets.includes('tutorials') ? TutorialsWidget : null,
    config.enabledWidgets.includes('contentEditors') ? ContentEditorWidget : null,
  ].filter(Boolean)
);

onMounted(load);
</script>

<template>
  <DashboardLayout page-title="Overview">
    <div class="overview">
      <OverviewGreeting />
      <AttentionStrip :charges="charges" :loaded="chargesLoaded" />

      <div class="overview__columns">
        <div class="overview__main">
          <MonthToDate :month="month" :state="monthState" />
          <MonthlyReportWidget />
        </div>
        <aside class="overview__side" aria-label="Site health">
          <SiteHealth :lighthouse="lighthouse" :loaded="healthLoaded" />
        </aside>
      </div>

      <div v-if="extras.length" class="overview__extras">
        <component :is="extra" v-for="(extra, i) in extras" :key="i" />
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.overview { display: flex; flex-direction: column; gap: 1.5rem; max-width: 1400px; }
.overview__columns { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.overview__main, .overview__side { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; }
.overview__extras { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }

@media (min-width: 1180px) {
  .overview__columns { grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr); }
}
</style>
