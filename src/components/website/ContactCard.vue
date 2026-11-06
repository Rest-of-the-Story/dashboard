<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Phone } from 'lucide-vue-next';
import EditCard from './EditCard.vue';
import type { SiteContent } from '@/types/siteContent';

const props = defineProps<{
  contact: NonNullable<SiteContent['contact']>;
  blocked?: string;
  studioUrl?: string;
  save: (data: { phone: string; email: string }) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'dirty', value: boolean): void }>();

const form = ref({ phone: props.contact.phone, email: props.contact.email });
const dirty = computed(() => form.value.phone.trim() !== props.contact.phone || form.value.email.trim() !== props.contact.email);

watch(() => props.contact, (c) => (form.value = { phone: c.phone, email: c.email }));
watch(dirty, (d) => emit('dirty', d), { immediate: true });

async function save() {
  if (!confirm('Change the phone number and email everywhere they appear on the website?')) {
    throw new Error('Not saved.');
  }
  await props.save({ phone: form.value.phone, email: form.value.email });
}
</script>

<template>
  <EditCard
    id="contact" title="Phone & email" :icon="Phone"
    :where="`Shown in the footer and on the Home, About and Contact pages (${contact.places} places). Saving changes them all at once.`"
    :dirty="dirty" :save="save" :blocked="blocked" :studio-url="studioUrl" @reset="form = { phone: contact.phone, email: contact.email }"
  >
    <div class="contact">
      <label class="field">
        <span class="field__label">Phone number</span>
        <input v-model="form.phone" class="field__input" type="tel" inputmode="tel" autocomplete="off" maxlength="30" />
      </label>
      <label class="field">
        <span class="field__label">Email address</span>
        <input v-model="form.email" class="field__input" type="email" autocomplete="off" maxlength="120" />
      </label>
    </div>
    <p class="field__hint">The address and map are set up separately; send us a request if the shop moves.</p>
  </EditCard>
</template>

<style scoped>
.contact { display: grid; gap: 0.9rem; }
@media (min-width: 640px) { .contact { grid-template-columns: 1fr 1fr; } }
</style>
