<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import DashboardLayout from '@/components/layout/DashboardLayout.vue';
import { useSanityQuery } from '@/composables/useSanity';
import config from '@/config/dashboard';
import { Lightbulb, PenLine, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-vue-next';

const { getAccessTokenSilently } = useAuth0();

interface Idea {
  _id: string;
  title: string;
  angle: string;
  category: string;
  pillar?: string;
  audience?: string;
  needsOwnerStory?: boolean;
  seasonal?: boolean;
}

const ideas = ref<Idea[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

// Per-idea UI state keyed by _id: 'creating' | { baseId } | error string
const creating = ref<Record<string, boolean>>({});
const created = ref<Record<string, string>>({}); // ideaId -> draft baseId
const createError = ref<Record<string, string>>({});

const CATEGORY_LABELS: Record<string, string> = {
  community: 'Community', faith: 'Faith', parenting: 'Parenting', thrifting: 'Thrifting',
};
const PILLAR_LABELS: Record<string, string> = {
  kids: 'Kids', homeschool: 'Homeschool', maternity: 'Maternity', general: 'Shop-wide',
};

const studioUrl = computed(() => {
  const link = config.links?.find((l) => /studio/i.test(l.label))?.url;
  return (link || 'https://studio.therestofthestory.store').replace(/\/$/, '');
});

function studioLink(baseId: string | undefined): string {
  if (!baseId) return studioUrl.value;
  return `${studioUrl.value}/intent/edit/id=${baseId};type=post/`;
}

const SHELF_QUERY = `*[_type == "postIdea" && used != true]{
  _id, title, angle, category, pillar, audience, needsOwnerStory,
  "seasonal": $month in seasons
} | order(seasonal desc, _createdAt asc)`;

onMounted(async () => {
  try {
    const month = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase();
    ideas.value = await useSanityQuery<Idea[]>(SHELF_QUERY, { month });
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Could not load ideas.';
  } finally {
    loading.value = false;
  }
});

async function createDraft(idea: Idea) {
  creating.value[idea._id] = true;
  createError.value[idea._id] = '';
  try {
    const token = await getAccessTokenSilently();
    const res = await fetch('/.netlify/functions/sanity-create-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ideaId: idea._id,
        title: idea.title,
        angle: idea.angle,
        category: idea.category,
        pillar: idea.pillar,
        audience: idea.audience,
        needsOwnerStory: idea.needsOwnerStory,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
    created.value[idea._id] = data.baseId;
  } catch (err) {
    createError.value[idea._id] = err instanceof Error ? err.message : 'Could not create the draft.';
  } finally {
    creating.value[idea._id] = false;
  }
}
</script>

<template>
  <DashboardLayout page-title="Blog Assist">
    <div class="assist">
      <header class="assist__intro">
        <Lightbulb :size="20" />
        <p>Pick an idea to start a blog post <strong>draft</strong> in your Sanity Studio. Ideas in season show first. Nothing publishes — you finish and publish each draft yourself.</p>
      </header>

      <div v-if="loading" class="assist__state">Loading ideas…</div>
      <div v-else-if="loadError" class="assist__state assist__state--error">{{ loadError }}</div>
      <div v-else-if="ideas.length === 0" class="assist__state">
        No ideas on the shelf right now — check back as new ones are added.
      </div>

      <ul v-else class="assist__list">
        <li v-for="idea in ideas" :key="idea._id" class="idea" :class="{ 'idea--done': created[idea._id] }">
          <div class="idea__main">
            <h3 class="idea__title">{{ idea.title }}</h3>
            <p class="idea__angle">{{ idea.angle }}</p>
            <div class="idea__tags">
              <span class="tag tag--cat">{{ CATEGORY_LABELS[idea.category] || idea.category }}</span>
              <span v-if="idea.pillar" class="tag">{{ PILLAR_LABELS[idea.pillar] || idea.pillar }}</span>
              <span v-if="idea.seasonal" class="tag tag--season">In season</span>
              <span v-if="idea.needsOwnerStory" class="tag tag--warn">
                <AlertTriangle :size="12" /> Needs a real story
              </span>
            </div>
          </div>

          <div class="idea__action">
            <template v-if="created[idea._id]">
              <span class="idea__done"><CheckCircle2 :size="16" /> Draft created</span>
              <a class="idea__open" :href="studioLink(created[idea._id])" target="_blank" rel="noopener">
                Open in Studio <ExternalLink :size="14" />
              </a>
            </template>
            <template v-else>
              <button class="idea__btn" :disabled="creating[idea._id]" @click="createDraft(idea)">
                <PenLine :size="15" />
                {{ creating[idea._id] ? 'Creating…' : 'Start a draft' }}
              </button>
              <span v-if="createError[idea._id]" class="idea__err">{{ createError[idea._id] }}</span>
            </template>
          </div>
        </li>
      </ul>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.assist { max-width: 820px; }
.assist__intro {
  display: flex; gap: 10px; align-items: flex-start;
  color: var(--color-text-secondary); margin-bottom: 20px; line-height: 1.5;
}
.assist__intro strong { color: var(--color-text); }
.assist__state { padding: 32px; text-align: center; color: var(--color-text-secondary); }
.assist__state--error { color: var(--color-danger, #c0574c); }

.assist__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.idea {
  display: flex; gap: 16px; justify-content: space-between; align-items: flex-start;
  padding: 16px; border: 1px solid var(--color-border); border-radius: var(--border-radius, 0.5rem);
  background: var(--color-surface);
}
.idea--done { opacity: 0.65; }
.idea__main { min-width: 0; }
.idea__title { margin: 0 0 4px; font-size: 1rem; color: var(--color-text); }
.idea__angle { margin: 0 0 10px; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.45; }
.idea__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  font-size: 0.7rem; padding: 2px 8px; border-radius: 999px;
  background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-secondary);
  display: inline-flex; align-items: center; gap: 4px;
}
.tag--cat { background: var(--color-primary); color: var(--color-text-inverse); border-color: transparent; }
.tag--season { background: var(--color-accent); color: var(--color-text-inverse); border-color: transparent; }
.tag--warn { color: #92400e; background: #fef3c7; border-color: #fde68a; }

.idea__action { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.idea__btn {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  padding: 8px 14px; border: none; border-radius: var(--border-radius, 0.5rem);
  background: var(--color-primary); color: var(--color-text-inverse);
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
}
.idea__btn:disabled { opacity: 0.6; cursor: default; }
.idea__done { display: inline-flex; align-items: center; gap: 5px; font-size: 0.85rem; color: var(--color-text-secondary); }
.idea__open { display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--color-primary); text-decoration: none; }
.idea__open:hover { text-decoration: underline; }
.idea__err { font-size: 0.75rem; color: var(--color-danger, #c0574c); max-width: 200px; text-align: right; }
</style>
