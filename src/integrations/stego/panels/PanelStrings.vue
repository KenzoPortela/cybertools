<script setup lang="ts">
/**
 * `strings` sur le fichier : suites de caractères imprimables, filtrables. On
 * lit les octets bruts (pas les pixels), donc aussi les données ajoutées après
 * l'image.
 */
import { NRadioButton, NRadioGroup } from 'naive-ui';
import { type FoundString, extractStrings } from '~/integrations/stego/formats/strings';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean }>();

const { t } = useI18n();

const minLength = ref(4);
const query = ref('');
const all = ref<FoundString[]>([]);

watch([() => props.active, () => props.image, minLength], () => {
  if (props.active) all.value = extractStrings(props.image.buffer, minLength.value);
}, { immediate: true });

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase();
  const list = term ? all.value.filter(s => s.text.toLowerCase().includes(term)) : all.value;
  return list.slice(0, 1000);
});

function hex(offset: number) {
  return `0x${offset.toString(16)}`;
}
</script>

<template>
  <div class="panel stego-panel-strings">
    <div class="controls">
      <div class="field">
        <span class="label">{{ t('app.stego.strings.minLength') }}</span>
        <NRadioGroup v-model:value="minLength" size="small">
          <NRadioButton v-for="n in [4, 6, 10]" :key="n" :value="n">
            {{ n }}
          </NRadioButton>
        </NRadioGroup>
      </div>
      <c-input-text v-model:value="query" :placeholder="t('app.stego.strings.filter')" raw-text class="search" />
      <span class="count ct-mono">{{ t('app.stego.strings.count', { count: filtered.length }) }}</span>
    </div>

    <p v-if="!all.length" class="empty">
      {{ t('app.stego.strings.none') }}
    </p>
    <div v-else class="list">
      <div v-for="(item, index) in filtered" :key="index" class="row ct-mono">
        <span class="offset">{{ hex(item.offset) }}</span>
        <span class="text">{{ item.text }}</span>
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

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.search {
  flex: 1 1 220px;
  max-width: 320px;
}

.count {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.list {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
}

.row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 12px;
  padding: 4px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--ct-border);
}

.row:last-child {
  border-bottom: none;
}

.offset {
  color: var(--ct-text-muted);
}

.text {
  overflow-wrap: anywhere;
}

.empty {
  margin: 0;
  color: var(--ct-text-muted);
}
</style>
