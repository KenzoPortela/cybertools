<script setup lang="ts">
/**
 * Color remapping : l'image sous différentes recompositions de couleur
 * (permutations de canaux, inversions, canaux isolés). Un motif caché n'est
 * parfois visible que dans une combinaison précise.
 */
import { REMAPS, type Remap, imageDataToUrl, makePreview, remapImage } from '~/integrations/stego/pixel-ops';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';

const props = defineProps<{ image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const tiles = ref<{ remap: Remap; url: string }[]>([]);
const selected = ref<Remap>();
const full = ref<ImageData>();

watch([() => props.active, () => props.image], () => {
  if (!props.active) return;
  const preview = makePreview(props.image.data, 240);
  tiles.value = REMAPS.map(remap => ({ remap, url: imageDataToUrl(remapImage(preview, remap)) }));
  selected.value = undefined;
  full.value = undefined;
}, { immediate: true });

function choose(remap: Remap) {
  selected.value = remap;
  full.value = remapImage(props.image.data, remap);
}
</script>

<template>
  <div class="panel stego-panel-colormap">
    <div v-if="full && selected" class="detail">
      <div class="detail-head">
        <span class="detail-name">{{ t(`app.stego.colormap.remaps.${selected.id}`) }}</span>
        <c-button size="small" @click="full = undefined">
          {{ t('app.stego.colormap.back') }}
        </c-button>
      </div>
      <StegoResultCanvas :image="full" :filename="`${filename}-${selected.id}`" />
    </div>

    <div v-else class="grid">
      <button v-for="tile in tiles" :key="tile.remap.id" type="button" class="tile" @click="choose(tile.remap)">
        <img :src="tile.url" :alt="t(`app.stego.colormap.remaps.${tile.remap.id}`)" class="thumb">
        <span class="caption">{{ t(`app.stego.colormap.remaps.${tile.remap.id}`) }}</span>
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
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
  background:
    repeating-conic-gradient(var(--ct-elevated) 0% 25%, transparent 0% 50%) 0 / 16px 16px;
  image-rendering: pixelated;
}

.caption {
  font-size: 12px;
  color: var(--ct-text-muted);
  text-align: center;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.detail-name {
  font-weight: 600;
}
</style>
