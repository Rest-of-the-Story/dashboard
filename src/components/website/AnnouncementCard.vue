<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Megaphone } from 'lucide-vue-next';
import EditCard from './EditCard.vue';

const props = defineProps<{
  text: string | null;
  blocked?: string;
  studioUrl?: string;
  save: (data: { text: string }) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'dirty', value: boolean): void }>();

const value = ref(props.text ?? '');
const dirty = computed(() => props.text !== null && value.value.trim() !== (props.text ?? '').trim());
const mentionsHours = computed(() => /\b(open|closed|hours|\d\s*(am|pm)|\d+-\d+)/i.test(value.value));
const lineCount = computed(() => value.value.split('\n').filter((l) => l.trim()).length);

watch(() => props.text, (t) => (value.value = t ?? ''));
watch(dirty, (d) => emit('dirty', d), { immediate: true });
</script>

<template>
  <EditCard
    id="announcement" title="Header message" :icon="Megaphone"
    where="The short line beside your logo at the top of every page. Good for hours, a sale or a closure."
    :dirty="dirty" :save="() => save({ text: value })" :blocked="blocked" :studio-url="studioUrl" @reset="value = text ?? ''"
  >
    <p v-if="text === null" class="card__empty">
      This message has formatting the dashboard can't edit without losing it. Use the Studio link above to change it.
    </p>
    <div v-else class="field">
      <label for="announcement-text" class="field__label">Message</label>
      <textarea id="announcement-text" v-model="value" class="field__input" rows="2" maxlength="400" aria-describedby="announcement-hint" />
      <p id="announcement-hint" class="field__hint">
        <span :class="{ 'warn': lineCount > 3 }">Up to 3 short lines; each line shows on its own.</span>
        <template v-if="mentionsHours"> This repeats your hours, so if you change them above, change this too.</template>
        Leave it empty to show nothing.
      </p>
    </div>
  </EditCard>
</template>

<style scoped>
.warn { color: var(--color-danger); font-weight: 600; }
</style>
