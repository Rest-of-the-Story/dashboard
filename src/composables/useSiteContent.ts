import { ref } from 'vue';
import { apiFetch } from './useApi';
import { useAuthToken } from './useAuthToken';
import type { SavePayload, SiteContent } from '@/types/siteContent';

const ENDPOINT = '/.netlify/functions/site-content';

/** Loads the Edit Website content and saves one section at a time. */
export function useSiteContent() {
  const authToken = useAuthToken();
  const content = ref<SiteContent | null>(null);
  const loading = ref(true);
  const loadError = ref('');

  async function load() {
    loading.value = true;
    loadError.value = '';
    try {
      content.value = await apiFetch<SiteContent>(ENDPOINT, { token: await authToken() });
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Could not load your website content.';
    } finally {
      loading.value = false;
    }
  }

  /** Saves a section; resolves once the website has it, rejects with a readable message. */
  async function save<S extends SavePayload['section']>(section: S, data: Extract<SavePayload, { section: S }>['data']) {
    if (!content.value) throw new Error('Nothing loaded yet.');
    content.value = await apiFetch<SiteContent>(ENDPOINT, {
      method: 'POST',
      token: await authToken(),
      body: JSON.stringify({ section, revs: content.value.revs, data }),
    });
  }

  return { content, loading, loadError, load, save };
}

const MAX_SEND_BYTES = 3_000_000;
const MAX_EDGE = 2400;

/**
 * Turns a chosen picture into a data: URL small enough to send. Pictures under
 * 3 MB go as they are (flyers keep their sharp text); bigger ones are scaled
 * down and saved as JPEG.
 */
export async function prepareImage(file: File): Promise<string> {
  const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read that picture.'));
      reader.readAsDataURL(blob);
    });

  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= MAX_SEND_BYTES) {
    return readAsDataUrl(file);
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That file isn’t a picture this browser can open. Try a JPEG or PNG.');
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.88, 0.78, 0.65]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length * 0.75 <= MAX_SEND_BYTES) return url;
  }
  throw new Error('That picture is too large even after shrinking it. Try a smaller one.');
}
