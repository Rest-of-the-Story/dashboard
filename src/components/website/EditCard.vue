<script setup lang="ts">
import { computed, ref } from 'vue';
import { AlertTriangle, CheckCircle2, ExternalLink, Undo2 } from 'lucide-vue-next';

/**
 * The frame every Edit Website section shares: title, what it changes, a Save
 * button that only wakes up when something changed, and the outcome.
 */
const props = defineProps<{
  id: string;
  title: string;
  icon: unknown;
  /** One line: where on the website this shows. */
  where: string;
  dirty: boolean;
  /** Runs the save; throw an Error with a readable message to report a problem. */
  save: () => Promise<void>;
  /** A Studio document with unpublished changes; editing is paused until it's resolved. */
  blocked?: string;
  studioUrl?: string;
}>();
const emit = defineEmits<{ (e: 'reset'): void }>();

const saving = ref(false);
const error = ref('');
const savedAt = ref<Date | null>(null);
const savedLabel = computed(() =>
  savedAt.value ? savedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
);

async function run() {
  saving.value = true;
  error.value = '';
  try {
    await props.save();
    savedAt.value = new Date();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not save. Please try again.';
  } finally {
    saving.value = false;
  }
}

function discard() {
  error.value = '';
  emit('reset');
}
</script>

<template>
  <section class="card edit" :aria-labelledby="`${id}-title`">
    <div class="card__head">
      <h2 :id="`${id}-title`" class="card__title"><component :is="icon" :size="18" aria-hidden="true" /> {{ title }}</h2>
      <a v-if="studioUrl" :href="studioUrl" target="_blank" rel="noopener noreferrer" class="card__link">
        In the Studio <ExternalLink :size="13" aria-hidden="true" /><span class="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
    <p class="edit__where">{{ where }}</p>

    <div v-if="blocked" class="edit__notice" role="status">
      <AlertTriangle :size="16" aria-hidden="true" />
      <p>
        The {{ blocked }} has unpublished changes in the Studio. Publish or discard them there first, so the
        two don't overwrite each other, then reload this page.
      </p>
    </div>

    <fieldset class="edit__body" :disabled="Boolean(blocked) || saving">
      <slot />
    </fieldset>

    <div class="edit__foot">
      <button type="button" class="btn btn--primary" :disabled="!dirty || saving || Boolean(blocked)" @click="run">
        {{ saving ? 'Saving…' : 'Save to website' }}
      </button>
      <button v-if="dirty && !saving" type="button" class="btn btn--quiet" @click="discard">
        <Undo2 :size="14" aria-hidden="true" /> Undo changes
      </button>
      <p class="edit__status" role="status" aria-live="polite">
        <span v-if="error" class="edit__error"><AlertTriangle :size="14" aria-hidden="true" /> {{ error }}</span>
        <span v-else-if="dirty" class="edit__pending">Not saved yet</span>
        <span v-else-if="savedAt" class="edit__ok">
          <CheckCircle2 :size="14" aria-hidden="true" /> Saved at {{ savedLabel }}. It will show on the website within a minute.
        </span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.edit__where { margin: -0.25rem 0 1rem; font-size: 0.875rem; color: var(--color-text-secondary); }
.card__link { display: inline-flex; align-items: center; gap: 0.25rem; }

.edit__notice {
  display: flex; gap: 0.5rem; align-items: flex-start; margin-bottom: 1rem; padding: 0.75rem 1rem;
  font-size: 0.875rem; line-height: 1.5; color: var(--color-text);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border-left: 3px solid var(--color-warning); border-radius: 0 var(--border-radius) var(--border-radius) 0;
}
.edit__notice p { margin: 0; }
.edit__notice svg { flex-shrink: 0; margin-top: 0.15rem; color: var(--color-warning); }

.edit__body { border: 0; margin: 0; padding: 0; min-width: 0; }
.edit__body:disabled { opacity: 0.6; }

.edit__foot {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--color-border);
}
.edit__status { margin: 0; font-size: 0.875rem; flex: 1 1 14rem; }
.edit__status span { display: inline-flex; align-items: center; gap: 0.35rem; }
.edit__error { color: var(--color-danger); }
.edit__pending { color: var(--color-warning); font-weight: 600; }
.edit__ok { color: var(--color-success); }
</style>
