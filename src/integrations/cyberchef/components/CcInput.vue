<script setup lang="ts">
/**
 * Panneau d'entrée d'une opération ou d'une recette : du texte, ou un fichier.
 *
 * Trois vues : le texte (avec numéros de ligne), ses octets en hexadécimal, et
 * le fichier chargé. Un bandeau dit ce qu'on sait de l'entrée sans la
 * calculer : position du curseur, entropie, et ce à quoi elle ressemble.
 */
import { useDebounce } from '@vueuse/core';
import { isMac } from '~/app/command-palette';
import CodeView from '~/integrations/cyberchef/components/CodeView.vue';
import { BINARY, entropy, hexdump, sniff, toBytes } from '~/integrations/cyberchef/data-view';
import { formatBytes } from '~/integrations/cyberchef/output';

export interface InputFile {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

const input = defineModel<string>('input', { required: true });
const file = defineModel<InputFile | undefined>('file');

withDefaults(defineProps<{
  /** Affiche un bouton « Exécuter » : opérations qui ne se relancent pas seules. */
  manual?: boolean;
  running?: boolean;
  /** `card` : un bloc de la page d'une opération ; `pane` : plein cadre, dans l'atelier. */
  variant?: 'card' | 'pane';
}>(), {
  manual: false,
  running: false,
  variant: 'card',
});

const emit = defineEmits<{ run: [] }>();

const { t, locale } = useI18n();
const titleId = useId();
/** Ctrl+Entrée, ⌘+Entrée sur Mac : exécuter tout de suite. */
const runKeys = isMac ? '⌘ ↵' : 'Ctrl ↵';
const fileInput = ref<HTMLInputElement>();

type Tab = 'text' | 'hex' | 'file';
const TABS: Tab[] = ['text', 'hex', 'file'];
const tab = ref<Tab>('text');
const cursor = ref({ line: 1, col: 1 });

async function load(selected: File | undefined) {
  if (!selected) return;
  file.value = { name: selected.name, size: selected.size, buffer: await selected.arrayBuffer() };
}

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  await load(target.files?.[0]);
  target.value = '';
}

function onDrop(event: DragEvent) {
  load(event.dataTransfer?.files[0]);
}

function clearAll() {
  input.value = '';
  file.value = undefined;
}

// --- Ce qu'on sait de l'entrée, recalculé une fois la frappe posée ------------

const settled = useDebounce(computed(() => file.value?.buffer ?? input.value), 250);
const bytes = computed(() => toBytes(settled.value));
const size = computed(() => (file.value ? file.value.size : bytes.value.length));
const bits = computed(() => entropy(bytes.value));
const resembles = computed(() => sniff(bytes.value).map(layer => (layer === BINARY ? t('app.cc.sniffBinary') : layer)).join(' → '));
const hex = computed(() => (tab.value === 'hex' ? hexdump(bytes.value) : undefined));

const entropyLabel = computed(() => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bits.value));

// --- Onglets, au clavier comme à la souris -----------------------------------

function onTabKey(event: KeyboardEvent) {
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!delta) return;
  event.preventDefault();
  tab.value = TABS[(TABS.indexOf(tab.value) + delta + TABS.length) % TABS.length];
  nextTick(() => (event.currentTarget as HTMLElement | null)?.parentElement?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
}
</script>

<template>
  <section
    class="io-panel cc-input"
    :class="`io-panel--${variant}`"
    :aria-labelledby="titleId"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <header class="io-head">
      <h2 :id="titleId" class="io-title ct-mono">
        {{ t('app.cc.input') }}
      </h2>
      <span class="io-meta ct-mono">{{ formatBytes(size) }}<template v-if="!file"> · UTF-8</template></span>

      <div class="io-tabs" role="tablist" :aria-label="t('app.cc.inputView')">
        <button
          v-for="id in TABS"
          :key="id"
          type="button"
          class="io-tab"
          role="tab"
          :aria-selected="tab === id"
          :tabindex="tab === id ? 0 : -1"
          @click="tab = id"
          @keydown="onTabKey"
        >
          {{ t(`app.cc.tabs.${id}`) }}
        </button>
      </div>

      <div class="io-actions">
        <button type="button" class="io-action" :aria-label="t('app.cc.loadFile')" :title="t('app.cc.loadFile')" @click="fileInput?.click()">
          <icon-mdi-paperclip aria-hidden="true" />
        </button>
        <button type="button" class="io-action" :aria-label="t('app.cc.clearInput')" :title="t('app.cc.clearInput')" :disabled="!input && !file" @click="clearAll">
          <icon-mdi-close aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="io-body" role="tabpanel" :aria-label="t(`app.cc.tabs.${tab}`)">
      <template v-if="tab === 'text'">
        <div v-if="file" class="file">
          <icon-mdi-file-outline class="file-icon" aria-hidden="true" />
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size ct-mono">{{ formatBytes(file.size) }}</span>
          <c-button size="small" variant="text" @click="file = undefined">
            {{ t('app.cc.removeFile') }}
          </c-button>
        </div>
        <CodeView
          v-else
          v-model:value="input"
          :label="t('app.cc.input')"
          :placeholder="t('app.cc.inputPlaceholder')"
          @cursor="(position) => cursor = position"
          @run="emit('run')"
        />
      </template>

      <template v-else-if="tab === 'hex'">
        <pre class="io-pre ct-mono">{{ hex?.text }}<span v-if="!hex?.text" class="io-placeholder">{{ t('app.cc.inputPlaceholder') }}</span></pre>
        <p v-if="hex?.truncated" class="io-note">
          {{ t('app.cc.hexTruncated', { size: formatBytes(64 * 1024) }) }}
        </p>
      </template>

      <div v-else class="drop">
        <icon-mdi-tray-arrow-down class="drop-icon" aria-hidden="true" />
        <p class="drop-text">
          {{ t('app.cc.dropHere') }}
        </p>
        <c-button size="small" @click="fileInput?.click()">
          <icon-mdi-paperclip class="button-icon" aria-hidden="true" />
          {{ t('app.cc.loadFile') }}
        </c-button>
        <p v-if="file" class="drop-file ct-mono">
          {{ file.name }} · {{ formatBytes(file.size) }}
        </p>
      </div>
    </div>

    <footer class="io-strip ct-mono">
      <span v-if="tab === 'text' && !file">{{ t('app.cc.cursor', cursor) }}</span>
      <span>{{ t('app.cc.entropy', { value: entropyLabel }) }}</span>
      <span v-if="resembles" class="resembles">{{ t('app.cc.resembles', { chain: resembles }) }}</span>
      <span class="io-strip-end">
        <c-button v-if="manual" size="small" type="primary" :disabled="running" class="run" @click="emit('run')">
          {{ t('app.cc.run') }}
        </c-button>
        <span><kbd>{{ runKeys }}</kbd> {{ t('app.cc.runShortcut') }}</span>
      </span>
    </footer>

    <input ref="fileInput" type="file" class="sr-only" @change="onFileSelected">
  </section>
</template>

<style scoped src="./io-panel.css"></style>

<style scoped>
.file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px;
  padding: 8px 12px;
  border: 1px dashed var(--ct-border-strong);
  border-radius: var(--ct-radius-control);
}

.file-icon {
  flex-shrink: 0;
  color: var(--ct-primary);
  font-size: 18px;
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: var(--ct-text-faint);
  font-size: 11px;
}

.drop {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px;
  padding: 16px;
  border: 1px dashed var(--ct-border-strong);
  border-radius: var(--ct-radius-panel);
  text-align: center;
}

.drop-icon {
  color: var(--ct-primary);
  font-size: 24px;
}

.drop-text {
  margin: 0;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
}

.drop-file {
  margin: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
}

.resembles {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
