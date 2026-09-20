<script setup lang="ts">
/**
 * Cacher / révéler un message dans une image, 100 % dans le navigateur. Trois
 * méthodes (LSB, chunk texte PNG, ajout après la fin du fichier), chiffrement
 * optionnel. Utilisé en outil autonome (`/tools/stego-hide`) et comme onglet du
 * Stego Lab (avec l'image déjà chargée comme support).
 */
import { NAlert, NRadioButton, NRadioGroup, NSpin } from 'naive-ui';
import { downloadBytes, formatBytes } from '~/integrations/cyberchef/output';
import { type HideMethod, hide, lsbCapacity, reveal } from '~/integrations/stego/hide';
import { useStegoImage } from '~/integrations/stego/useStegoImage';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{
  /** Support fourni par le Stego Lab (l'image déjà chargée). */
  cover?: StegoImage;
  active?: boolean;
}>();

const { t } = useI18n();

const mode = ref<'hide' | 'reveal'>('hide');
const method = ref<HideMethod>('lsb');
const message = ref('');
const password = ref('');

const { image: ownImage, error: loadError, load } = useStegoImage();
const source = computed(() => props.cover ?? ownImage.value);

const fileInput = ref<HTMLInputElement>();
const dragging = ref(false);
function pick() {
  fileInput.value?.click();
}
function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) load(file);
}
function onDrop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) load(file);
}

const busy = ref(false);
const error = ref<string>();

// --- Cacher ------------------------------------------------------------------
const output = ref<Uint8Array>();
const verified = ref<boolean>();

const usedBytes = computed(() => new TextEncoder().encode(message.value).length);
const capacity = computed(() => (source.value && method.value === 'lsb' ? lsbCapacity(source.value.data) : undefined));
const tooLarge = computed(() => capacity.value !== undefined && usedBytes.value > capacity.value);

async function runHide() {
  if (!source.value || !message.value) return;
  busy.value = true;
  error.value = undefined;
  output.value = undefined;
  verified.value = undefined;
  try {
    const bytes = await hide({ image: source.value.data, buffer: source.value.buffer }, { method: method.value, message: message.value, password: password.value || undefined });
    output.value = bytes;
    // Vérification immédiate : on relit ce qu'on vient de cacher.
    try {
      verified.value = (await reveal(bytes.buffer as ArrayBuffer, method.value, password.value || undefined)) === message.value;
    }
    catch {
      verified.value = false;
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}

function downloadOutput() {
  if (!output.value) return;
  const ext = method.value === 'lsb' || source.value?.type === 'image/png' ? 'png' : (source.value?.name.split('.').pop() ?? 'bin');
  downloadBytes(output.value.buffer as ArrayBuffer, `${(source.value?.name ?? 'image').replace(/\.[^.]+$/, '')}-hidden.${ext}`);
}

// --- Révéler -----------------------------------------------------------------
const revealed = ref<string>();

async function runReveal() {
  if (!source.value) return;
  busy.value = true;
  error.value = undefined;
  revealed.value = undefined;
  try {
    revealed.value = await reveal(source.value.buffer, method.value, password.value || undefined);
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}

// Réinitialise les résultats quand le contexte change.
watch([mode, method, () => source.value, message, password], () => {
  output.value = undefined;
  verified.value = undefined;
  revealed.value = undefined;
  error.value = undefined;
});
</script>

<template>
  <div class="hide">
    <div class="mode">
      <NRadioGroup v-model:value="mode" size="small">
        <NRadioButton value="hide">
          {{ t('app.stego.hide.hideMode') }}
        </NRadioButton>
        <NRadioButton value="reveal">
          {{ t('app.stego.hide.revealMode') }}
        </NRadioButton>
      </NRadioGroup>
    </div>

    <!-- Support (image autonome). Dans le Stego Lab, l'image chargée sert de support. -->
    <div v-if="!cover" class="source">
      <div
        class="drop stego-hide-drop"
        :class="{ 'drop--over': dragging, 'drop--filled': source }"
        role="button"
        tabindex="0"
        @click="pick"
        @keydown.enter.prevent="pick"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <icon-mdi-image-outline class="drop-icon" aria-hidden="true" />
        <span v-if="source" class="drop-name ct-mono">{{ source.name }} · {{ source.width }}×{{ source.height }}</span>
        <span v-else>{{ t('app.stego.hide.source') }}</span>
      </div>
      <NAlert v-if="loadError" type="error" class="alert">
        {{ t(`app.stego.errors.${loadError}`) }}
      </NAlert>
    </div>

    <template v-if="source">
      <div class="field">
        <span class="label">{{ t('app.stego.hide.method') }}</span>
        <NRadioGroup v-model:value="method" size="small">
          <NRadioButton value="lsb">
            {{ t('app.stego.hide.methods.lsb') }}
          </NRadioButton>
          <NRadioButton value="text">
            {{ t('app.stego.hide.methods.text') }}
          </NRadioButton>
          <NRadioButton value="append">
            {{ t('app.stego.hide.methods.append') }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <c-input-text v-model:value="password" type="password" :placeholder="t('app.stego.hide.password')" class="password" />

      <!-- Cacher -->
      <template v-if="mode === 'hide'">
        <c-input-text
          v-model:value="message"
          multiline
          rows="5"
          raw-text
          :placeholder="t('app.stego.hide.message')"
          class="message stego-hide-message"
        />
        <p v-if="capacity !== undefined" class="capacity ct-mono" :class="{ over: tooLarge }">
          {{ t('app.stego.hide.capacity', { used: usedBytes, total: capacity }) }}
        </p>

        <div class="actions">
          <c-button type="primary" size="small" :disabled="!message || tooLarge || busy" class="stego-hide-run" @click="runHide">
            <icon-mdi-lock-outline class="button-icon" aria-hidden="true" />
            {{ t('app.stego.hide.hideAction') }}
          </c-button>
          <NSpin v-if="busy" size="small" />
        </div>

        <NAlert v-if="error" type="error" class="alert">
          {{ t(`app.stego.hide.errors.${error}`, error) }}
        </NAlert>

        <div v-if="output" class="result stego-hide-output">
          <NAlert :type="verified ? 'success' : 'warning'" :show-icon="true" class="alert">
            {{ verified ? t('app.stego.hide.verified') : t('app.stego.hide.notVerified') }} · {{ formatBytes(output.length) }}
          </NAlert>
          <c-button size="small" class="stego-hide-download" @click="downloadOutput">
            <icon-mdi-download class="button-icon" aria-hidden="true" />
            {{ t('app.stego.hide.download') }}
          </c-button>
        </div>
      </template>

      <!-- Révéler -->
      <template v-else>
        <div class="actions">
          <c-button type="primary" size="small" :disabled="busy" class="stego-reveal-run" @click="runReveal">
            <icon-mdi-lock-open-variant-outline class="button-icon" aria-hidden="true" />
            {{ t('app.stego.hide.revealAction') }}
          </c-button>
          <NSpin v-if="busy" size="small" />
        </div>

        <NAlert v-if="error" type="error" class="alert">
          {{ t(`app.stego.hide.errors.${error}`, error) }}
        </NAlert>

        <div v-if="revealed !== undefined" class="revealed">
          <span class="label">{{ t('app.stego.hide.revealed') }}</span>
          <pre class="revealed-text ct-mono stego-reveal-output">{{ revealed }}</pre>
        </div>
      </template>
    </template>

    <input ref="fileInput" type="file" accept="image/*" class="sr-only stego-hide-input" @change="onFileChange">
  </div>
</template>

<style scoped>
.hide {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.mode {
  display: flex;
}

.drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 90px;
  padding: 16px;
  border: 2px dashed var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  cursor: pointer;
  color: var(--ct-text-muted);
  transition: border-color 0.15s ease;
}

.drop:hover,
.drop--over {
  border-color: var(--ct-primary);
}

.drop--filled {
  color: var(--ct-text);
}

.drop-icon {
  font-size: 22px;
  color: var(--ct-primary);
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.password {
  max-width: 320px;
}

.capacity {
  margin: 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}

.capacity.over {
  color: var(--ct-error);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.button-icon {
  margin-right: 6px;
}

.result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert {
  margin: 0;
}

.revealed {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.revealed-text {
  margin: 0;
  padding: 12px;
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
