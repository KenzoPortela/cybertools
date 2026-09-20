<script setup lang="ts">
/**
 * Plans de bits (façon StegSolve) : pour un canal et un bit donnés, l'image
 * binaire de ce bit. Les bits de poids faible portent souvent les données
 * cachées en LSB. Mode « grille » : les 8 plans du canal d'un coup.
 */
import { NRadioButton, NRadioGroup, NSwitch } from 'naive-ui';
import { bitPlaneImage, imageDataToUrl, makePreview } from '~/integrations/stego/pixel-ops';
import type { StegoEngine } from '~/integrations/stego/stego-engine';
import type { Channel } from '~/integrations/stego/stego-worker';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';
import { useStegoResult } from '~/integrations/stego/use-stego-result';

const props = defineProps<{ engine: StegoEngine; image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 0, label: 'R' },
  { value: 1, label: 'G' },
  { value: 2, label: 'B' },
  { value: 3, label: 'A' },
];

const mode = ref<'single' | 'grid'>('single');
const channel = ref<Channel>(0);
const bit = ref(0);
const colour = ref(false);

// --- Vue unique (worker, plein écran interactif) -----------------------------
const { result, recompute } = useStegoResult(() =>
  (props.active && mode.value === 'single' && props.engine.ready.value)
    ? props.engine.run({ type: 'bitPlane', channel: channel.value, bit: bit.value, colour: colour.value })
    : undefined,
);
watch([() => props.active, () => props.image, props.engine.ready, mode, channel, bit, colour], recompute, { immediate: true });

// --- Grille (vignettes des 8 plans, thread principal) ------------------------
const tiles = ref<{ bit: number; url: string }[]>([]);
watch([() => props.active, () => props.image, mode, channel], () => {
  if (!props.active || mode.value !== 'grid') return;
  const preview = makePreview(props.image.data, 220);
  tiles.value = Array.from({ length: 8 }, (_, b) => ({ bit: b, url: imageDataToUrl(bitPlaneImage(preview, channel.value, b)) }));
}, { immediate: true });

function openBit(b: number) {
  bit.value = b;
  mode.value = 'single';
}
</script>

<template>
  <div class="panel stego-panel-bitplanes">
    <div class="controls">
      <div class="field">
        <span class="label">{{ t('app.stego.bitPlanes.channel') }}</span>
        <NRadioGroup v-model:value="channel" size="small">
          <NRadioButton v-for="c in CHANNELS" :key="c.value" :value="c.value">
            {{ c.label }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <div class="field">
        <NRadioGroup v-model:value="mode" size="small">
          <NRadioButton value="single">
            {{ t('app.stego.bitPlanes.single') }}
          </NRadioButton>
          <NRadioButton value="grid">
            {{ t('app.stego.bitPlanes.grid') }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <template v-if="mode === 'single'">
        <div class="field">
          <span class="label">{{ t('app.stego.bitPlanes.bit') }}</span>
          <NRadioGroup v-model:value="bit" size="small">
            <NRadioButton v-for="b in 8" :key="b - 1" :value="b - 1">
              {{ b - 1 }}
            </NRadioButton>
          </NRadioGroup>
        </div>
        <label class="field field--switch">
          <NSwitch v-model:value="colour" size="small" />
          <span class="label">{{ t('app.stego.bitPlanes.colour') }}</span>
        </label>
      </template>
    </div>

    <template v-if="mode === 'single'">
      <p class="hint">
        {{ t('app.stego.bitPlanes.hint') }}
      </p>
      <StegoResultCanvas :image="result" :filename="`${filename}-plane`" />
    </template>

    <div v-else class="grid">
      <button v-for="tile in tiles" :key="tile.bit" type="button" class="tile" @click="openBit(tile.bit)">
        <img :src="tile.url" :alt="`bit ${tile.bit}`" class="thumb">
        <span class="caption ct-mono">{{ t('app.stego.bitPlanes.bit') }} {{ tile.bit }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.field--switch {
  cursor: pointer;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.tile:hover {
  border-color: var(--ct-primary);
}

.thumb {
  width: 100%;
  border-radius: var(--ct-radius-micro);
  image-rendering: pixelated;
}

.caption {
  font-size: 11px;
  color: var(--ct-text-muted);
  text-align: center;
}
</style>
