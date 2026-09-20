<script setup lang="ts">
/**
 * Canaux & rehaussements : isoler un canal (R/G/B/A) ou la luminance, puis
 * forcer le contraste (inversion, seuil, étirement, égalisation). Révèle du
 * texte caché dans un seul canal ou dans une plage de valeurs étroite.
 */
import { NRadioButton, NRadioGroup, NSlider } from 'naive-ui';
import type { StegoEngine } from '~/integrations/stego/stego-engine';
import type { ChannelView, Enhance } from '~/integrations/stego/stego-worker';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';
import { useStegoResult } from '~/integrations/stego/use-stego-result';

const props = defineProps<{ engine: StegoEngine; image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const VIEWS: ChannelView[] = ['rgb', 'r', 'g', 'b', 'a', 'luma'];
const ENHANCERS: Enhance[] = ['none', 'invert', 'threshold', 'stretch', 'equalise'];

const view = ref<ChannelView>('rgb');
const enhancer = ref<Enhance>('none');
const level = ref(128);

const { result, recompute } = useStegoResult(() =>
  (props.active && props.engine.ready.value)
    ? props.engine.run({ type: 'channel', view: view.value, enhance: enhancer.value, level: level.value })
    : undefined,
);

watch([() => props.active, () => props.image, props.engine.ready, view, enhancer, level], recompute, { immediate: true });
</script>

<template>
  <div class="panel stego-panel-channels">
    <div class="controls">
      <div class="field">
        <span class="label">{{ t('app.stego.channels.view') }}</span>
        <NRadioGroup v-model:value="view" size="small">
          <NRadioButton v-for="v in VIEWS" :key="v" :value="v">
            {{ t(`app.stego.channels.views.${v}`) }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <div class="field">
        <span class="label">{{ t('app.stego.channels.enhance') }}</span>
        <NRadioGroup v-model:value="enhancer" size="small">
          <NRadioButton v-for="e in ENHANCERS" :key="e" :value="e">
            {{ t(`app.stego.channels.enhancers.${e}`) }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <div v-if="enhancer === 'threshold'" class="field field--slider">
        <span class="label">{{ t('app.stego.channels.level') }}</span>
        <NSlider v-model:value="level" :min="0" :max="255" :step="1" class="slider" />
        <span class="value ct-mono">{{ level }}</span>
      </div>
    </div>

    <StegoResultCanvas :image="result" :filename="`${filename}-${view}`" />
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

.field--slider {
  flex: 1 1 220px;
  min-width: 200px;
}

.slider {
  flex: 1;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.value {
  min-width: 30px;
  font-size: 12px;
  color: var(--ct-text-muted);
  text-align: right;
}
</style>
