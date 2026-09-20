<script setup lang="ts">
/**
 * Stego Lab : déposer une image et l'analyser entièrement dans le navigateur —
 * métadonnées, plans de bits, LSB, structure. Rien n'est envoyé à un serveur.
 *
 * Dépôt/collage/décodage de l'image, visualiseur partagé, et les panneaux
 * d'analyse en onglets. Tout le calcul pixel se fait dans un Web Worker
 * (`StegoEngine`), hors du thread principal.
 */
import { useEventListener } from '@vueuse/core';
import { NAlert, NSpin, NTabPane, NTabs } from 'naive-ui';
import { formatBytes } from '~/integrations/cyberchef/output';
import PanelBitPlanes from '~/integrations/stego/panels/PanelBitPlanes.vue';
import PanelChannels from '~/integrations/stego/panels/PanelChannels.vue';
import PanelColorMap from '~/integrations/stego/panels/PanelColorMap.vue';
import PanelCompare from '~/integrations/stego/panels/PanelCompare.vue';
import PanelEla from '~/integrations/stego/panels/PanelEla.vue';
import PanelEntropy from '~/integrations/stego/panels/PanelEntropy.vue';
import PanelInfo from '~/integrations/stego/panels/PanelInfo.vue';
import PanelLsb from '~/integrations/stego/panels/PanelLsb.vue';
import PanelMetadata from '~/integrations/stego/panels/PanelMetadata.vue';
import PanelStrings from '~/integrations/stego/panels/PanelStrings.vue';
import PanelStructure from '~/integrations/stego/panels/PanelStructure.vue';
import { StegoEngine } from '~/integrations/stego/stego-engine';
import StegoResultCanvas from '~/integrations/stego/StegoResultCanvas.vue';
import { useStegoImage } from '~/integrations/stego/useStegoImage';

const { t } = useI18n();
const { image, busy, error, load, clear } = useStegoImage();

const fileInput = ref<HTMLInputElement>();
const dragging = ref(false);
const activeTab = ref('original');

// Un seul worker pour tous les panneaux : il garde l'image et calcule les vues.
const engine = new StegoEngine();
const engineReady = engine.ready;

/** Base du nom pour les fichiers exportés (sans extension). */
const baseName = computed(() => (image.value?.name ?? 'image').replace(/\.[^.]+$/, ''));

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

// Coller une image depuis le presse-papiers.
useEventListener(window, 'paste', (event: ClipboardEvent) => {
  const file = [...(event.clipboardData?.items ?? [])]
    .find(item => item.type.startsWith('image/'))?.getAsFile();
  if (file) load(file);
});

// Chaque nouvelle image est chargée dans le worker ; les panneaux s'appuient
// ensuite dessus.
watch(image, (value) => {
  if (value) engine.load(value.data);
});

onBeforeUnmount(() => engine.terminate());
</script>

<template>
  <div class="stego">
    <!-- Aucune image : la zone de dépôt occupe toute la place. -->
    <div
      v-if="!image"
      class="drop stego-drop"
      :class="{ 'drop--over': dragging }"
      role="button"
      tabindex="0"
      @click="pick"
      @keydown.enter.prevent="pick"
      @keydown.space.prevent="pick"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <NSpin v-if="busy" size="large" />
      <template v-else>
        <icon-mdi-image-search-outline class="drop-icon" aria-hidden="true" />
        <p class="drop-title">
          {{ t('app.stego.drop') }}
        </p>
        <p class="drop-hint">
          {{ t('app.stego.formats') }}
        </p>
      </template>
    </div>

    <NAlert v-if="error" type="error" class="stego-error" :title="t('app.stego.errorTitle')">
      {{ t(`app.stego.errors.${error}`) }}
    </NAlert>

    <!-- Image chargée : en-tête + onglets d'analyse. -->
    <div v-if="image" class="workspace">
      <header class="bar">
        <div class="meta">
          <span class="name">{{ image.name }}</span>
          <span class="dims ct-mono stego-dims">{{ t('app.stego.dimensions', { w: image.width, h: image.height }) }}</span>
          <span class="dot" aria-hidden="true">·</span>
          <span class="ct-mono">{{ image.type }}</span>
          <span class="dot" aria-hidden="true">·</span>
          <span class="ct-mono">{{ formatBytes(image.size) }}</span>
          <span v-if="engineReady" class="engine stego-engine-ok">
            <span class="engine-dot" aria-hidden="true" />
            {{ t('app.stego.engineReady') }}
          </span>
        </div>
        <c-button size="small" @click="clear">
          <icon-mdi-image-off-outline class="icon" />
          {{ t('app.stego.change') }}
        </c-button>
      </header>

      <NTabs v-model:value="activeTab" type="line" animated class="tabs">
        <NTabPane name="original" :tab="t('app.stego.tabs.original')">
          <StegoResultCanvas :image="image.data" :filename="baseName" />
        </NTabPane>
        <NTabPane name="info" :tab="t('app.stego.tabs.info')">
          <PanelInfo :image="image" :active="activeTab === 'info'" />
        </NTabPane>
        <NTabPane name="bitplanes" :tab="t('app.stego.tabs.bitPlanes')">
          <PanelBitPlanes :engine="engine" :image="image" :active="activeTab === 'bitplanes'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="channels" :tab="t('app.stego.tabs.channels')">
          <PanelChannels :engine="engine" :image="image" :active="activeTab === 'channels'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="colormap" :tab="t('app.stego.tabs.colorMap')">
          <PanelColorMap :image="image" :active="activeTab === 'colormap'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="entropy" :tab="t('app.stego.tabs.entropy')">
          <PanelEntropy :engine="engine" :image="image" :active="activeTab === 'entropy'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="metadata" :tab="t('app.stego.tabs.metadata')">
          <PanelMetadata :image="image" :active="activeTab === 'metadata'" />
        </NTabPane>
        <NTabPane name="structure" :tab="t('app.stego.tabs.structure')">
          <PanelStructure :image="image" :active="activeTab === 'structure'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="lsb" :tab="t('app.stego.tabs.lsb')">
          <PanelLsb :engine="engine" :image="image" :active="activeTab === 'lsb'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="strings" :tab="t('app.stego.tabs.strings')">
          <PanelStrings :image="image" :active="activeTab === 'strings'" />
        </NTabPane>
        <NTabPane name="ela" :tab="t('app.stego.tabs.ela')">
          <PanelEla :engine="engine" :image="image" :active="activeTab === 'ela'" :filename="baseName" />
        </NTabPane>
        <NTabPane name="compare" :tab="t('app.stego.tabs.compare')">
          <PanelCompare :engine="engine" :image="image" :active="activeTab === 'compare'" :filename="baseName" />
        </NTabPane>
      </NTabs>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="sr-only stego-file-input"
      @change="onFileChange"
    >
  </div>
</template>

<style scoped>
.stego {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 320px;
  padding: 40px 20px;
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
  font-size: 40px;
  color: var(--ct-primary);
}

.drop-title {
  margin: 0;
  font-weight: 600;
}

.drop-hint {
  margin: 0;
  font-size: 13px;
  color: var(--ct-text-muted);
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ct-text-muted);
  min-width: 0;
}

.name {
  font-weight: 600;
  color: var(--ct-text);
  overflow-wrap: anywhere;
}

.dims {
  color: var(--ct-text);
}

.dot {
  opacity: 0.5;
}

.engine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ct-primary);
}

.engine-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.icon {
  margin-right: 6px;
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
