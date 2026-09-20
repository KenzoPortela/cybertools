<script setup lang="ts">
/**
 * Plans de bits (façon StegSolve) : pour un canal et un bit donnés, l'image
 * binaire de ce bit. Les bits de poids faible portent souvent les données
 * cachées en LSB.
 */
import { NRadioButton, NRadioGroup, NSwitch } from 'naive-ui';
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

const channel = ref<Channel>(0);
const bit = ref(0);
const colour = ref(false);

const { result, recompute } = useStegoResult(() =>
  (props.active && props.engine.ready.value)
    ? props.engine.run({ type: 'bitPlane', channel: channel.value, bit: bit.value, colour: colour.value })
    : undefined,
);

watch([() => props.active, () => props.image, props.engine.ready, channel, bit, colour], recompute, { immediate: true });
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
    </div>

    <p class="hint">
      {{ t('app.stego.bitPlanes.hint') }}
    </p>

    <StegoResultCanvas :image="result" :filename="`${filename}-plane`" />
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
</style>
