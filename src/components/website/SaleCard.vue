<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Tag, ImagePlus, Trash2, ExternalLink } from 'lucide-vue-next';
import EditCard from './EditCard.vue';
import RichTextField from './RichTextField.vue';
import { prepareImage } from '@/composables/useSiteContent';
import config from '@/config/dashboard';
import type { SaleSave, SiteContent } from '@/types/siteContent';

const props = defineProps<{
  sale: NonNullable<SiteContent['sale']>;
  blocked?: string;
  studioUrl?: string;
  save: (data: SaleSave) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'dirty', value: boolean): void }>();

const fromProps = () => ({
  heading: props.sale.heading,
  body: props.sale.body ?? '',
  altText: props.sale.altText,
  inMenu: props.sale.inMenu,
  menuLabel: props.sale.menuLabel,
});
const form = ref(fromProps());
/** A newly chosen picture (data: URL) or 'remove'; nothing = leave the current one. */
const image = ref<string | undefined>();
const imageError = ref('');
const preparing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const dirty = computed(() => Boolean(image.value) || JSON.stringify(form.value) !== JSON.stringify(fromProps()));
const shownImage = computed(() => (image.value === 'remove' ? null : image.value ?? props.sale.imageUrl));
const pageUrl = `https://${config.clientDomain}${props.sale.path}`;

function reset() {
  form.value = fromProps();
  image.value = undefined;
  imageError.value = '';
}
watch(() => props.sale, reset);
watch(dirty, (d) => emit('dirty', d), { immediate: true });
onBeforeUnmount(() => (image.value = undefined));

async function choose(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;
  imageError.value = '';
  preparing.value = true;
  try {
    image.value = await prepareImage(file);
  } catch (err) {
    imageError.value = err instanceof Error ? err.message : 'Could not use that picture.';
  } finally {
    preparing.value = false;
  }
}

async function save() {
  await props.save({
    ...form.value,
    body: props.sale.body === null ? null : form.value.body,
    ...(image.value ? { image: image.value } : {}),
  });
  image.value = undefined;
}
</script>

<template>
  <EditCard
    id="sale" title="Sale page" :icon="Tag"
    :where="`Your ${sale.title} page. Use it for each sale: change the heading and flyer, then put it in the menu while the sale is on.`"
    :dirty="dirty" :save="save" :blocked="blocked" :studio-url="studioUrl" @reset="reset"
  >
    <div class="sale">
      <div class="sale__text">
        <label class="field">
          <span class="field__label">Heading</span>
          <input v-model="form.heading" class="field__input" type="text" maxlength="160" placeholder="e.g. Black Friday & Saturday Sale, Nov 27–28" />
        </label>

        <RichTextField v-if="sale.body !== null" id="sale-body" v-model="form.body" label="Details" :rows="5" hint="Dates, times, what's on sale." />
        <p v-else class="card__empty">The details text has formatting the dashboard can't edit; change it in the Studio.</p>

        <fieldset class="sale__menu">
          <legend class="field__label">Website menu</legend>
          <label class="sale__toggle">
            <input v-model="form.inMenu" type="checkbox" />
            Show this page in the menu
          </label>
          <label v-if="form.inMenu" class="field">
            <span class="field__label">Menu label</span>
            <input v-model="form.menuLabel" class="field__input" type="text" maxlength="30" placeholder="Sale" />
          </label>
          <p class="field__hint">
            While it's out of the menu, people can still reach the page from a link you share:
            <a :href="pageUrl" target="_blank" rel="noopener noreferrer">{{ pageUrl.replace('https://', '') }} <ExternalLink :size="12" aria-hidden="true" /><span class="sr-only"> (opens in a new tab)</span></a>
          </p>
        </fieldset>
      </div>

      <div class="sale__image">
        <span class="field__label">Flyer or photo</span>
        <div class="sale__frame">
          <img v-if="shownImage" :src="shownImage" :alt="form.altText || 'Sale picture'" />
          <p v-else class="card__empty">No picture</p>
        </div>
        <div class="sale__imgtools">
          <button type="button" class="btn btn--small" :disabled="preparing" @click="fileInput?.click()">
            <ImagePlus :size="14" aria-hidden="true" /> {{ preparing ? 'Preparing…' : shownImage ? 'Replace' : 'Add a picture' }}
          </button>
          <button v-if="shownImage" type="button" class="btn btn--quiet btn--small" @click="image = sale.imageUrl ? 'remove' : undefined">
            <Trash2 :size="14" aria-hidden="true" /> Remove
          </button>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" @change="choose" />
        </div>
        <p v-if="imageError" class="sale__err" role="alert">{{ imageError }}</p>
        <label v-if="shownImage" class="field">
          <span class="field__label">Describe the picture</span>
          <input v-model="form.altText" class="field__input" type="text" maxlength="300" placeholder="e.g. Flyer: Black Friday sale, Nov 27–28, 10am–5pm" />
          <span class="field__hint">Read aloud to people who can't see it. If it's a flyer, include its dates and times.</span>
        </label>
      </div>
    </div>
  </EditCard>
</template>

<style scoped>
.sale { display: grid; gap: 1.25rem; }
@media (min-width: 900px) { .sale { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); } }
.sale__text, .sale__image { display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
.sale__image { gap: 0.6rem; }

.sale__menu { border: 1px solid var(--color-border); border-radius: var(--border-radius); padding: 0.75rem 0.9rem; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.sale__menu legend { padding: 0 0.3rem; }
.sale__toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; }
.sale__menu a { color: var(--color-primary); text-decoration: underline; word-break: break-all; }

.sale__frame {
  display: flex; align-items: center; justify-content: center; min-height: 10rem; max-height: 22rem; overflow: hidden;
  background: var(--color-bg); border: 1px dashed var(--color-border); border-radius: var(--border-radius);
}
.sale__frame img { max-width: 100%; max-height: 22rem; object-fit: contain; }
.sale__imgtools { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.sale__err { margin: 0; font-size: 0.875rem; color: var(--color-danger); }
</style>
