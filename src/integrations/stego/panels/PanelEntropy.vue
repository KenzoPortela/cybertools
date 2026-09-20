<script setup lang="ts">
/**
 * Carte d'entropie : chaque bloc est coloré selon l'entropie de Shannon de sa
 * luminance (0 sombre → 8 bits rouge). Les zones chiffrées ou compressées —
 * donc à forte entropie — ressortent nettement.
 */
import { NRadioButton, NRadioGroup } from 'naive-ui';
import type { StegoEngine } from '~/integrations/stego/stego-engine';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';
import { useStegoResult } from '~/integrations/stego/use-stego-result';

const props = defineProps<{ engine: StegoEngine; image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const BLOCKS = [8, 16, 32];
const block = ref(16);

const { result, recompute } = useStegoResult(() =>
  (props.active && props.engine.ready.value)
    ? props.engine.run({ type: 'entropy', block: block.value })
    : undefined,
);

watch([() => props.active, () => props.image, props.engine.ready, block], recompute, { immediate: true });
</script>

<template>
  <div class="panel stego-panel-entropy">
    <div class="controls">
      <div class="field">
        <span class="label">{{ t('app.stego.entropy.block') }}</span>
        <NRadioGroup v-model:value="block" size="small">
          <NRadioButton v-for="b in BLOCKS" :key="b" :value="b">
            {{ b }} px
          </NRadioButton>
        </NRadioGroup>
      </div>

      <div class="scale" aria-hidden="true">
        <span class="label">{{ t('app.stego.entropy.low') }}</span>
        <span class="ramp" />
        <span class="label">{{ t('app.stego.entropy.high') }}</span>
      </div>
    </div>

    <p class="hint">
      {{ t('app.stego.entropy.hint') }}
    </p>

    <StegoResultCanvas :image="result" :filename="`${filename}-entropy`" />
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
  justify-content: space-between;
  gap: 12px 20px;
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scale {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ramp {
  width: 120px;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(16, 35, 58), rgb(31, 111, 120), rgb(217, 176, 56), rgb(229, 72, 77));
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
