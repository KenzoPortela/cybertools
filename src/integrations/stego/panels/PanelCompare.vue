<script setup lang="ts">
/**
 * Comparaison de deux images : différence absolue, XOR ou superposition. Sert à
 * repérer ce qui a changé entre un original et une version modifiée.
 */
import { NAlert, NRadioButton, NRadioGroup, NSlider } from 'naive-ui';
import type { StegoEngine } from '~/integrations/stego/stego-engine';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';
import { useStegoImage } from '~/integrations/stego/useStegoImage';
import { useStegoResult } from '~/integrations/stego/use-stego-result';

const props = defineProps<{ engine: StegoEngine; image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const MODES = ['diff', 'xor', 'overlay'] as const;
const mode = ref<typeof MODES[number]>('diff');
const opacity = ref(0.5);

const { image: second, error, load } = useStegoImage();
const fileInput = ref<HTMLInputElement>();
const dragging = ref(false);
const loaded = ref(false);

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

// Charge la seconde image dans le worker dès qu'elle est décodée.
watch(second, async (value) => {
  loaded.value = false;
  if (value) {
    await props.engine.loadSecond(value.data);
    loaded.value = true;
    recompute();
  }
});

const mismatch = computed(() =>
  second.value && (second.value.width !== props.image.width || second.value.height !== props.image.height),
);

const { result, recompute } = useStegoResult(() =>
  (props.active && props.engine.ready.value && loaded.value)
    ? props.engine.run({ type: 'compare', mode: mode.value, opacity: opacity.value })
    : undefined,
);

watch([() => props.active, () => props.image, props.engine.ready, mode, opacity], () => {
  // Recharge la seconde image si l'image principale a changé sous elle.
  if (second.value && loaded.value) recompute();
}, { immediate: true });
</script>

<template>
  <div class="panel stego-panel-compare">
    <div v-if="!second" class="pick">
      <div
        class="drop stego-compare-drop"
        :class="{ 'drop--over': dragging }"
        role="button"
        tabindex="0"
        @click="pick"
        @keydown.enter.prevent="pick"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <icon-mdi-image-plus-outline class="drop-icon" aria-hidden="true" />
        <p class="drop-title">
          {{ t('app.stego.compare.pick') }}
        </p>
      </div>
      <NAlert v-if="error" type="error" class="error">
        {{ t(`app.stego.errors.${error}`) }}
      </NAlert>
    </div>

    <template v-else>
      <div class="controls">
        <div class="field">
          <span class="label">{{ t('app.stego.compare.mode') }}</span>
          <NRadioGroup v-model:value="mode" size="small">
            <NRadioButton v-for="m in MODES" :key="m" :value="m">
              {{ t(`app.stego.compare.modes.${m}`) }}
            </NRadioButton>
          </NRadioGroup>
        </div>
        <div v-if="mode === 'overlay'" class="field field--slider">
          <span class="label">{{ t('app.stego.compare.opacity') }}</span>
          <NSlider v-model:value="opacity" :min="0" :max="1" :step="0.05" class="slider" />
        </div>
        <c-button size="small" class="change" @click="pick">
          {{ t('app.stego.compare.change') }}
        </c-button>
      </div>

      <NAlert v-if="mismatch" type="warning" class="mismatch" :show-icon="false">
        {{ t('app.stego.compare.mismatch') }}
      </NAlert>

      <StegoResultCanvas :image="result" :filename="`${filename}-compare`" />
    </template>

    <input ref="fileInput" type="file" accept="image/*" class="sr-only stego-compare-input" @change="onFileChange">
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 200px;
  padding: 32px 20px;
  border: 2px dashed var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.drop:hover,
.drop:focus-visible {
  border-color: var(--ct-primary);
}

.drop--over {
  border-color: var(--ct-primary);
  background: var(--ct-primary-faded);
}

.drop-icon {
  font-size: 32px;
  color: var(--ct-primary);
}

.drop-title {
  margin: 0;
  font-weight: 600;
}

.error {
  margin-top: 10px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field--slider {
  flex: 1 1 200px;
  min-width: 180px;
}

.slider {
  flex: 1;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.change {
  margin-left: auto;
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
