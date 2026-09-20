<script setup lang="ts">
/**
 * pngcheck local : chaque chunk PNG vérifié (CRC) et interprété, erreurs
 * signalées, verdict final.
 */
import { NAlert } from 'naive-ui';
import { type PngCheckReport, pngcheck } from '~/integrations/stego/formats/pngcheck';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean }>();

const { t } = useI18n();

const report = ref<PngCheckReport>();

watch([() => props.active, () => props.image], () => {
  if (props.active) report.value = pngcheck(props.image.buffer);
}, { immediate: true });

function hex(offset: number) {
  return `0x${offset.toString(16).padStart(6, '0')}`;
}
</script>

<template>
  <div v-if="report" class="panel stego-panel-pngcheck">
    <p v-if="!report.isPng" class="empty">
      {{ t('app.stego.pngcheck.onlyPng') }}
    </p>

    <template v-else>
      <NAlert :type="report.errors.length ? 'error' : 'success'" class="verdict" :show-icon="true">
        {{ report.summary }}
      </NAlert>

      <ul v-if="report.errors.length" class="errors">
        <li v-for="(error, index) in report.errors" :key="index" class="error">
          {{ error }}
        </li>
      </ul>

      <div class="chunks ct-mono">
        <div v-for="(chunk, index) in report.chunks" :key="index" class="chunk">
          <span class="chunk-line">
            <span class="chunk-name">{{ chunk.name }}</span>
            <span class="chunk-at">{{ hex(chunk.offset) }}</span>
            <span class="chunk-len">{{ t('app.stego.pngcheck.length', { n: chunk.length }) }}</span>
            <span class="chunk-crc" :class="chunk.crcOk ? 'ok' : 'bad'">{{ chunk.crcOk ? 'CRC OK' : 'CRC BAD' }}</span>
          </span>
          <span v-if="chunk.note" class="chunk-note">{{ chunk.note }}</span>
        </div>
      </div>
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

.errors {
  margin: 0;
  padding-left: 18px;
  color: var(--ct-error);
  font-size: 13px;
}

.chunks {
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  overflow: hidden;
  font-size: 12px;
}

.chunk {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--ct-border);
}

.chunk:last-child {
  border-bottom: none;
}

.chunk-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px;
}

.chunk-name {
  font-weight: 600;
  min-width: 44px;
}

.chunk-at,
.chunk-len {
  color: var(--ct-text-muted);
}

.chunk-crc {
  margin-left: auto;
  font-size: 11px;
}

.chunk-crc.ok {
  color: var(--ct-success);
}

.chunk-crc.bad {
  color: var(--ct-error);
}

.chunk-note {
  color: var(--ct-text-muted);
  overflow-wrap: anywhere;
}
</style>
