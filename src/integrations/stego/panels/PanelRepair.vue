<script setup lang="ts">
/**
 * Réparation PNG (PCRT-lite) : rétablit la signature et recalcule les CRC
 * erronés. Affiche le journal, rend l'image réparée et permet de la
 * télécharger.
 */
import { NAlert } from 'naive-ui';
import { onBeforeUnmount } from 'vue';
import { downloadBytes } from '~/integrations/cyberchef/output';
import { matchAt } from '~/integrations/stego/formats/signatures';
import { type RepairResult, repairPng } from '~/integrations/stego/formats/pngrepair';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const result = ref<RepairResult>();
const previewUrl = ref<string>();
const rendered = ref<boolean>();

function reset() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = undefined;
  rendered.value = undefined;
}

const isPng = computed(() => matchAt(new Uint8Array(props.image.buffer), 0)?.ext === 'png');

watch([() => props.active, () => props.image], () => {
  reset();
  if (!props.active || !isPng.value) return;
  const repaired = repairPng(props.image.buffer);
  result.value = repaired;
  const blob = new Blob([repaired.output], { type: 'image/png' });
  previewUrl.value = URL.createObjectURL(blob);
}, { immediate: true });

onBeforeUnmount(reset);

function download() {
  if (result.value) downloadBytes(result.value.output.buffer as ArrayBuffer, `${props.filename}-repaired.png`);
}
</script>

<template>
  <div class="panel stego-panel-repair">
    <p v-if="!isPng" class="empty">
      {{ t('app.stego.repair.onlyPng') }}
    </p>

    <template v-else-if="result">
      <pre class="log ct-mono">{{ result.log.join('\n') }}</pre>

      <NAlert :type="rendered === false ? 'warning' : 'info'" :show-icon="false" class="status">
        {{ rendered === false ? t('app.stego.repair.stillBroken') : (result.changed ? t('app.stego.repair.done') : t('app.stego.repair.clean')) }}
      </NAlert>

      <div v-if="previewUrl" class="preview">
        <img :src="previewUrl" alt="" class="image" @load="rendered = true" @error="rendered = false">
      </div>

      <c-button size="small" class="stego-repair-download" @click="download">
        <icon-mdi-download class="button-icon" aria-hidden="true" />
        {{ t('app.stego.repair.download') }}
      </c-button>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  margin: 0;
  color: var(--ct-text-muted);
}

.log {
  margin: 0;
  padding: 12px;
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  font-size: 12px;
  white-space: pre-wrap;
}

.preview {
  display: flex;
  justify-content: center;
  padding: 12px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background:
    repeating-conic-gradient(var(--ct-elevated) 0% 25%, transparent 0% 50%) 0 / 20px 20px;
}

.image {
  max-width: 100%;
  max-height: 460px;
  image-rendering: pixelated;
}

.button-icon {
  margin-right: 6px;
}
</style>
