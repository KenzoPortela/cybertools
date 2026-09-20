<script setup lang="ts">
/**
 * Extraction LSB (façon zsteg) : lit les bits de poids faible des canaux
 * choisis et reconstruit un flux d'octets, à lire en texte ou en hexdump. Une
 * signature reconnue en tête révèle un fichier caché ; le flux peut être
 * poursuivi dans les Recettes.
 */
import { NRadioButton, NRadioGroup, NSwitch } from 'naive-ui';
import { useRouter } from 'vue-router';
import { downloadBytes } from '~/integrations/cyberchef/output';
import { matchAt } from '~/integrations/stego/formats/signatures';
import type { StegoEngine } from '~/integrations/stego/stego-engine';
import type { Channel } from '~/integrations/stego/stego-worker';
import type { StegoImage } from '~/integrations/stego/useStegoImage';
import { useRecipeStore } from '~/stores/recipe';

const props = defineProps<{ engine: StegoEngine; image: StegoImage; active: boolean; filename: string }>();

const { t } = useI18n();
const router = useRouter();
const recipes = useRecipeStore();

const LIMIT = 65536;
const CHANNELS: { value: Channel; label: string }[] = [
  { value: 0, label: 'R' },
  { value: 1, label: 'G' },
  { value: 2, label: 'B' },
  { value: 3, label: 'A' },
];

const selected = ref<Channel[]>([0, 1, 2]);
const bits = ref(1);
const msbFirst = ref(false);
const column = ref(false);
const format = ref<'text' | 'hex'>('text');

function toggleChannel(channel: Channel) {
  // On garde l'ordre R, G, B, A parmi les canaux cochés.
  const next = selected.value.includes(channel)
    ? selected.value.filter(c => c !== channel)
    : [...selected.value, channel].sort((a, b) => a - b);
  selected.value = next;
}

const bytes = ref<Uint8Array>();
let token = 0;

async function recompute() {
  if (!props.active || !props.engine.ready.value || !selected.value.length) {
    bytes.value = selected.value.length ? bytes.value : undefined;
    return;
  }
  const mine = ++token;
  const out = await props.engine.runBytes({
    type: 'lsb',
    channels: [...selected.value],
    bits: bits.value,
    msbFirst: msbFirst.value,
    column: column.value,
    limit: LIMIT,
  });
  if (mine === token) bytes.value = out;
}

watch(
  [() => props.active, () => props.image, props.engine.ready, selected, bits, msbFirst, column],
  recompute,
  { immediate: true, deep: true },
);

const latin1 = new TextDecoder('latin1');
const text = computed(() => (bytes.value ? latin1.decode(bytes.value.subarray(0, 16384)) : ''));

const hexdump = computed(() => {
  const data = bytes.value;
  if (!data) return '';
  const rows: string[] = [];
  for (let i = 0; i < Math.min(data.length, 4096); i += 16) {
    const slice = data.subarray(i, i + 16);
    const hex = [...slice].map(b => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...slice].map(b => (b >= 0x20 && b <= 0x7E ? String.fromCharCode(b) : '.')).join('');
    rows.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return rows.join('\n');
});

const detected = computed(() => (bytes.value ? matchAt(bytes.value, 0)?.name : undefined));

function openInRecipes() {
  if (!bytes.value) return;
  const hex = [...bytes.value].map(b => b.toString(16).padStart(2, '0')).join('');
  recipes.openWith([{ op: 'From Hex', args: ['Auto'] }], hex);
  router.push('/tools/recipes');
}

function download() {
  if (bytes.value) downloadBytes(bytes.value.buffer as ArrayBuffer, `${props.filename}-lsb.bin`);
}
</script>

<template>
  <div class="panel stego-panel-lsb">
    <div class="controls">
      <div class="field">
        <span class="label">{{ t('app.stego.lsb.channels') }}</span>
        <div class="channels">
          <button
            v-for="c in CHANNELS"
            :key="c.value"
            type="button"
            class="chan"
            :class="{ 'chan--on': selected.includes(c.value) }"
            @click="toggleChannel(c.value)"
          >
            {{ c.label }}
          </button>
        </div>
      </div>

      <div class="field">
        <span class="label">{{ t('app.stego.lsb.bits') }}</span>
        <NRadioGroup v-model:value="bits" size="small">
          <NRadioButton v-for="n in 4" :key="n" :value="n">
            {{ n }}
          </NRadioButton>
        </NRadioGroup>
      </div>

      <label class="field field--switch">
        <NSwitch v-model:value="msbFirst" size="small" />
        <span class="label">{{ t('app.stego.lsb.msbFirst') }}</span>
      </label>

      <label class="field field--switch">
        <NSwitch v-model:value="column" size="small" />
        <span class="label">{{ t('app.stego.lsb.column') }}</span>
      </label>
    </div>

    <p v-if="!selected.length" class="empty">
      {{ t('app.stego.lsb.pickChannel') }}
    </p>

    <template v-else>
      <div class="bar">
        <NRadioGroup v-model:value="format" size="small">
          <NRadioButton value="text">
            {{ t('app.stego.lsb.text') }}
          </NRadioButton>
          <NRadioButton value="hex">
            {{ t('app.stego.lsb.hex') }}
          </NRadioButton>
        </NRadioGroup>
        <span v-if="detected" class="detected ct-mono">
          <icon-mdi-file-alert-outline aria-hidden="true" />
          {{ t('app.stego.lsb.detected', { name: detected }) }}
        </span>
      </div>

      <pre class="output ct-mono">{{ format === 'hex' ? hexdump : text }}</pre>

      <div class="actions">
        <c-button size="small" class="stego-lsb-recipes" @click="openInRecipes">
          <icon-mdi-chef-hat class="button-icon" aria-hidden="true" />
          {{ t('app.stego.lsb.openInRecipes') }}
        </c-button>
        <c-button size="small" @click="download">
          <icon-mdi-download class="button-icon" aria-hidden="true" />
          {{ t('app.stego.lsb.download') }}
        </c-button>
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

.field--switch {
  cursor: pointer;
}

.label {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.channels {
  display: flex;
  gap: 4px;
}

.chan {
  width: 30px;
  height: 28px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-micro);
  background: var(--ct-surface);
  color: var(--ct-text-muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.chan--on {
  border-color: var(--ct-primary);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-weight: 600;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.detected {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ct-warning);
}

.output {
  margin: 0;
  padding: 12px;
  height: 340px;
  overflow: auto;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.button-icon {
  margin-right: 6px;
}

.empty {
  margin: 0;
  color: var(--ct-text-muted);
}
</style>
