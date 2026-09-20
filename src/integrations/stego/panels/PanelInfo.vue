<script setup lang="ts">
/**
 * Infos et statistiques de l'image : format, dimensions, profondeur, DPI,
 * empreintes (MD5/SHA), nombre de couleurs, et statistiques par canal.
 * Équivalent local de « identify » + infos de base.
 */
import { formatBytes } from '~/integrations/cyberchef/output';
import { type ImageInfo, computeHashes, computeInfo } from '~/integrations/stego/metadata/info';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

const props = defineProps<{ image: StegoImage; active: boolean }>();

const { t } = useI18n();

const info = ref<ImageInfo>();
const hashes = ref<{ md5: string; sha1: string; sha256: string }>();

watch([() => props.active, () => props.image], async () => {
  if (!props.active) return;
  info.value = computeInfo(props.image);
  hashes.value = undefined;
  hashes.value = await computeHashes(props.image.buffer);
}, { immediate: true });

const properties = computed(() => {
  const i = info.value;
  if (!i) return [];
  return [
    { key: t('app.stego.info.format'), value: i.format ?? i.mime },
    { key: t('app.stego.info.dimensions'), value: `${i.width} × ${i.height} px` },
    { key: t('app.stego.info.size'), value: formatBytes(i.size) },
    ...(i.colourType ? [{ key: t('app.stego.info.colourType'), value: i.colourType }] : []),
    ...(i.bitDepth ? [{ key: t('app.stego.info.bitDepth'), value: `${i.bitDepth} ${t('app.stego.info.bits')}` }] : []),
    ...(i.dpi ? [{ key: t('app.stego.info.dpi'), value: `${i.dpi} DPI` }] : []),
    { key: t('app.stego.info.colours'), value: i.colourCount },
  ];
});

function fixed(value: number) {
  return value.toFixed(2);
}
</script>

<template>
  <div v-if="info" class="panel stego-panel-info">
    <section class="block">
      <h3 class="block-title">
        {{ t('app.stego.info.properties') }}
      </h3>
      <dl class="props">
        <div v-for="prop in properties" :key="prop.key" class="prop">
          <dt>{{ prop.key }}</dt>
          <dd class="ct-mono">
            {{ prop.value }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="block">
      <h3 class="block-title">
        {{ t('app.stego.info.hashes') }}
      </h3>
      <dl class="props">
        <div v-for="algo in ['md5', 'sha1', 'sha256']" :key="algo" class="prop">
          <dt>{{ algo.toUpperCase() }}</dt>
          <dd class="ct-mono hash">
            {{ hashes ? hashes[algo as 'md5' | 'sha1' | 'sha256'] : '…' }}
          </dd>
        </div>
      </dl>
    </section>

    <section class="block">
      <h3 class="block-title">
        {{ t('app.stego.info.channels') }}
      </h3>
      <div class="stats">
        <div class="stat stat--head ct-mono">
          <span />
          <span>min</span><span>max</span><span>{{ t('app.stego.info.mean') }}</span>
          <span>{{ t('app.stego.info.std') }}</span><span>{{ t('app.stego.info.entropy') }}</span>
        </div>
        <div v-for="channel in info.channels" :key="channel.name" class="stat ct-mono">
          <span class="stat-name">{{ channel.name }}</span>
          <span>{{ channel.min }}</span>
          <span>{{ channel.max }}</span>
          <span>{{ fixed(channel.mean) }}</span>
          <span>{{ fixed(channel.std) }}</span>
          <span>{{ fixed(channel.entropy) }}</span>
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

.block-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ct-text-muted);
}

.props {
  margin: 0;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  overflow: hidden;
}

.prop {
  display: grid;
  grid-template-columns: minmax(120px, 200px) 1fr;
  gap: 12px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--ct-border);
}

.prop:last-child {
  border-bottom: none;
}

.prop dt {
  color: var(--ct-text-muted);
  font-size: 13px;
}

.prop dd {
  margin: 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.hash {
  color: var(--ct-text);
}

.stats {
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  overflow: hidden;
}

.stat {
  display: grid;
  grid-template-columns: 60px repeat(5, 1fr);
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--ct-border);
  text-align: right;
}

.stat:last-child {
  border-bottom: none;
}

.stat--head {
  color: var(--ct-text-muted);
  background: var(--ct-elevated);
}

.stat-name {
  text-align: left;
  color: var(--ct-text-muted);
}

@media (max-width: 560px) {
  .stat {
    font-size: 11px;
    gap: 4px;
  }
}
</style>
