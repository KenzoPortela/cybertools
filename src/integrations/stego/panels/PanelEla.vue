<script setup lang="ts">
/**
 * Error Level Analysis : l'image est ré-encodée en JPEG, et l'écart avec
 * l'original est amplifié. Une zone collée ou retouchée, compressée
 * différemment du reste, ressort en clair.
 */
import { NSlider } from 'naive-ui';
import type { StegoEngine } from '~/integrations/stego/stego-engine';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';
import { useStegoResult } from '~/integrations/stego/use-stego-result';

const props = defineProps<{ engine: StegoEngine; image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const quality = ref(90);
const scale = ref(15);

const { result, recompute } = useStegoResult(() =>
  (props.active && props.engine.ready.value)
    ? props.engine.run({ type: 'ela', quality: quality.value, scale: scale.value })
    : undefined,
);

watch([() => props.active, () => props.image, props.engine.ready, quality, scale], recompute, { immediate: true });
</script>

<template>
  <div class="panel stego-panel-ela">
    <div class="controls">
      <div class="field">
        <span class="label">{{ t('app.stego.ela.quality') }}</span>
        <NSlider v-model:value="quality" :min="30" :max="100" :step="1" class="slider" />
        <span class="value ct-mono">{{ quality }}</span>
      </div>
      <div class="field">
        <span class="label">{{ t('app.stego.ela.scale') }}</span>
        <NSlider v-model:value="scale" :min="1" :max="40" :step="1" class="slider" />
        <span class="value ct-mono">×{{ scale }}</span>
      </div>
    </div>

    <p class="hint">
      {{ t('app.stego.ela.hint') }}
    </p>

    <StegoResultCanvas :image="result" :filename="`${filename}-ela`" />
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
  gap: 12px 24px;
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 240px;
  min-width: 220px;
}

.slider {
  flex: 1;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
  white-space: nowrap;
}

.value {
  min-width: 34px;
  font-size: 12px;
  color: var(--ct-text-muted);
  text-align: right;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}
</style>
