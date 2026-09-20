<script setup lang="ts">
/**
 * Métadonnées de l'image : EXIF, GPS, IPTC, XMP, ICC… lues localement via
 * exifr. Les coordonnées GPS sont affichées et copiables ; aucune carte n'est
 * chargée (ce serait une requête réseau).
 */
import { NSpin } from 'naive-ui';
import { useCopy } from '@/composable/copy';
import { type Metadata, readMetadata } from '~/integrations/stego/metadata/exif';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean }>();

const { t } = useI18n();

const meta = ref<Metadata>();
const busy = ref(false);
const query = ref('');

async function refresh() {
  if (!props.active) return;
  busy.value = true;
  try {
    meta.value = await readMetadata(props.image.buffer);
  }
  finally {
    busy.value = false;
  }
}

watch([() => props.active, () => props.image], refresh, { immediate: true });

const filtered = computed(() => {
  const groups = meta.value?.groups ?? [];
  const term = query.value.trim().toLowerCase();
  if (!term) return groups;
  return groups
    .map(group => ({
      id: group.id,
      entries: group.entries.filter(e => `${e.key} ${e.value}`.toLowerCase().includes(term)),
    }))
    .filter(group => group.entries.length);
});

const empty = computed(() => !busy.value && !meta.value?.gps && !(meta.value?.groups.length));

const gpsText = computed(() => (meta.value?.gps ? `${meta.value.gps.latitude}, ${meta.value.gps.longitude}` : ''));
const { copy: copyGps } = useCopy({ source: gpsText, text: t('app.stego.metadata.copied') });
</script>

<template>
  <div class="panel stego-panel-metadata">
    <div v-if="busy" class="state">
      <NSpin size="small" />
      <span>{{ t('app.stego.metadata.reading') }}</span>
    </div>

    <p v-else-if="empty" class="empty">
      {{ t('app.stego.metadata.none') }}
    </p>

    <template v-else>
      <div v-if="meta?.gps" class="gps">
        <icon-mdi-map-marker class="gps-icon" aria-hidden="true" />
        <span class="gps-coords ct-mono">{{ gpsText }}</span>
        <c-button size="small" @click="copyGps()">
          <icon-mdi-content-copy class="button-icon" aria-hidden="true" />
          {{ t('app.stego.metadata.copy') }}
        </c-button>
      </div>

      <c-input-text v-model:value="query" :placeholder="t('app.stego.metadata.search')" raw-text class="search" />

      <section v-for="group in filtered" :key="group.id" class="group">
        <h3 class="group-title ct-mono">
          {{ group.id }}
        </h3>
        <dl class="entries">
          <div v-for="entry in group.entries" :key="entry.key" class="entry">
            <dt class="key">
              {{ entry.key }}
            </dt>
            <dd class="value ct-mono">
              {{ entry.value }}
            </dd>
          </div>
        </dl>
      </section>

      <p v-if="query && !filtered.length" class="empty">
        {{ t('app.stego.metadata.noMatch') }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ct-text-muted);
  font-size: 13px;
}

.empty {
  margin: 0;
  color: var(--ct-text-muted);
}

.gps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 14px;
  border: 1px solid var(--ct-border);
  border-left: 3px solid var(--ct-primary);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
}

.gps-icon {
  font-size: 18px;
  color: var(--ct-primary);
}

.gps-coords {
  font-weight: 600;
}

.button-icon {
  margin-right: 6px;
}

.search {
  max-width: 320px;
}

.group {
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  overflow: hidden;
}

.group-title {
  margin: 0;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ct-text-muted);
  background: var(--ct-elevated);
  border-bottom: 1px solid var(--ct-border);
}

.entries {
  margin: 0;
}

.entry {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 12px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--ct-border);
}

.entry:last-child {
  border-bottom: none;
}

.key {
  color: var(--ct-text-muted);
  font-size: 13px;
}

.value {
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (max-width: 560px) {
  .entry {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
