<script setup lang="ts">
/**
 * Carving façon binwalk / foremost : signatures de fichiers et flux zlib repérés
 * dans les octets, extraction de ce qui est embarqué. Utile pour sortir une
 * archive ou une image cachée dans une autre.
 */
import { downloadBytes } from '~/integrations/cyberchef/output';
import { type Finding, carve, inflateAt, sliceFrom } from '~/integrations/stego/formats/carve';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();

const findings = ref<Finding[]>([]);

watch([() => props.active, () => props.image], () => {
  if (props.active) findings.value = carve(props.image.buffer);
}, { immediate: true });

function hex(offset: number) {
  return `0x${offset.toString(16)}`;
}

function extract(finding: Finding) {
  if (finding.kind === 'zlib') {
    downloadBytes(inflateAt(props.image.buffer, finding.offset).buffer as ArrayBuffer, `${props.filename}-${hex(finding.offset)}.bin`);
  }
  else {
    downloadBytes(sliceFrom(props.image.buffer, finding.offset), `${props.filename}-${hex(finding.offset)}.${finding.ext ?? 'bin'}`);
  }
}
</script>

<template>
  <div class="panel stego-panel-carve">
    <p class="hint">
      {{ t('app.stego.carve.hint') }}
    </p>

    <p v-if="!findings.length" class="empty">
      {{ t('app.stego.carve.none') }}
    </p>

    <div v-else class="table ct-mono">
      <div class="row row--head">
        <span>{{ t('app.stego.carve.decimal') }}</span>
        <span>{{ t('app.stego.carve.hex') }}</span>
        <span>{{ t('app.stego.carve.description') }}</span>
        <span />
      </div>
      <div v-for="(finding, index) in findings" :key="index" class="row">
        <span>{{ finding.offset }}</span>
        <span class="muted">{{ hex(finding.offset) }}</span>
        <span class="desc">
          {{ finding.description }}
          <span v-if="finding.inflatedLength" class="muted">· {{ t('app.stego.carve.inflated', { n: finding.inflatedLength }) }}</span>
        </span>
        <c-button size="small" @click="extract(finding)">
          <icon-mdi-download aria-hidden="true" />
        </c-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint,
.empty {
  margin: 0;
  font-size: 13px;
  color: var(--ct-text-muted);
}

.table {
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  overflow: hidden;
  font-size: 12px;
}

.row {
  display: grid;
  grid-template-columns: 90px 90px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 5px 12px;
  border-bottom: 1px solid var(--ct-border);
}

.row:last-child {
  border-bottom: none;
}

.row--head {
  color: var(--ct-text-muted);
  background: var(--ct-elevated);
}

.muted {
  color: var(--ct-text-muted);
}

.desc {
  overflow-wrap: anywhere;
}
</style>
