<script setup lang="ts">
/**
 * Structure du fichier : chunks PNG ou segments JPEG, textes cachés, données
 * ajoutées après la fin logique, fichiers embarqués (mini-binwalk) et
 * polyglotte. La cachette la plus fréquente : une archive collée derrière
 * l'image.
 */
import { NAlert } from 'naive-ui';
import { formatBytes, downloadBytes } from '~/integrations/cyberchef/output';
import { type StructureReport, analyseStructure } from '~/integrations/stego/formats/structure';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const report = ref<StructureReport>();

watch([() => props.active, () => props.image], () => {
  if (props.active) report.value = analyseStructure(props.image.buffer);
}, { immediate: true });

function hex(offset: number) {
  return `0x${offset.toString(16)}`;
}

function downloadTrailing() {
  if (!report.value?.trailing) return;
  const { offset } = report.value.trailing;
  downloadBytes(props.image.buffer.slice(offset), `${props.filename}-trailing.bin`);
}
</script>

<template>
  <div v-if="report" class="panel stego-panel-structure">
    <NAlert v-if="report.polyglot" type="warning" class="polyglot" :show-icon="true" :title="t('app.stego.structure.polyglotTitle')">
      {{ t('app.stego.structure.polyglotBody') }}
    </NAlert>

    <p class="format">
      <span class="label">{{ t('app.stego.structure.format') }}</span>
      <span class="ct-mono">{{ report.format ?? t('app.stego.structure.unknown') }}</span>
    </p>

    <!-- Textes cachés (chunks tEXt/zTXt/iTXt, commentaires JPEG). -->
    <section v-if="report.texts.length" class="block">
      <h3 class="block-title">
        {{ t('app.stego.structure.texts') }}
      </h3>
      <div v-for="(finding, index) in report.texts" :key="index" class="finding">
        <span class="finding-source ct-mono">{{ finding.source }}</span>
        <pre class="finding-text">{{ finding.text }}</pre>
      </div>
    </section>

    <!-- Données ajoutées après la fin logique de l'image. -->
    <section v-if="report.trailing" class="block">
      <h3 class="block-title">
        {{ t('app.stego.structure.trailing') }}
      </h3>
      <div class="trailing">
        <p class="trailing-info ct-mono">
          {{ t('app.stego.structure.trailingInfo', { offset: hex(report.trailing.offset), size: formatBytes(report.trailing.length) }) }}
          <span v-if="report.trailing.signature" class="trailing-sig">→ {{ report.trailing.signature }}</span>
        </p>
        <c-button size="small" class="stego-trailing-download" @click="downloadTrailing">
          <icon-mdi-download class="button-icon" aria-hidden="true" />
          {{ t('app.stego.structure.download') }}
        </c-button>
      </div>
    </section>

    <!-- Fichiers embarqués repérés par signature. -->
    <section v-if="report.embedded.length" class="block">
      <h3 class="block-title">
        {{ t('app.stego.structure.embedded') }}
      </h3>
      <ul class="embedded">
        <li v-for="found in report.embedded" :key="`${found.name}-${found.offset}`" class="embedded-item ct-mono">
          <span class="embedded-name">{{ found.name }}</span>
          <span class="embedded-offset">{{ hex(found.offset) }}</span>
        </li>
      </ul>
    </section>

    <!-- Chunks / segments. -->
    <section class="block">
      <h3 class="block-title">
        {{ t('app.stego.structure.chunks') }} <span class="count">{{ report.chunks.length }}</span>
      </h3>
      <p v-if="!report.chunks.length" class="empty">
        {{ t('app.stego.structure.noChunks') }}
      </p>
      <div v-else class="chunks">
        <div class="chunk chunk--head ct-mono">
          <span>{{ t('app.stego.structure.name') }}</span>
          <span>{{ t('app.stego.structure.offset') }}</span>
          <span>{{ t('app.stego.structure.size') }}</span>
        </div>
        <div v-for="(chunk, index) in report.chunks" :key="index" class="chunk ct-mono">
          <span class="chunk-name">{{ chunk.name }}</span>
          <span>{{ hex(chunk.offset) }}</span>
          <span>{{ formatBytes(chunk.length) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.format {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
}

.label {
  color: var(--ct-text-muted);
}

.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ct-text-muted);
}

.count {
  padding: 0 7px;
  border-radius: var(--ct-radius-pill);
  background: var(--ct-neutral);
  font-size: 11px;
}

.finding {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.finding-source {
  font-size: 11px;
  color: var(--ct-primary);
}

.finding-text {
  margin: 0;
  padding: 8px 10px;
  max-height: 160px;
  overflow: auto;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-micro);
  background: var(--ct-surface);
  font-family: var(--ct-font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.trailing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.trailing-info {
  margin: 0;
  font-size: 12px;
}

.trailing-sig {
  color: var(--ct-warning);
}

.button-icon {
  margin-right: 6px;
}

.embedded {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.embedded-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-micro);
  font-size: 12px;
}

.embedded-offset {
  color: var(--ct-text-muted);
}

.chunks {
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  overflow: hidden;
}

.chunk {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  padding: 6px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--ct-border);
}

.chunk:last-child {
  border-bottom: none;
}

.chunk--head {
  color: var(--ct-text-muted);
  background: var(--ct-elevated);
}

.empty {
  margin: 0;
  color: var(--ct-text-muted);
  font-size: 13px;
}
</style>
