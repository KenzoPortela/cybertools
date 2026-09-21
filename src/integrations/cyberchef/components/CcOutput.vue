<script setup lang="ts">
/**
 * Panneau de sortie d'une opération ou d'une recette.
 *
 * Quatre vues : le texte brut (avec l'offset de chaque ligne), les octets en
 * hexadécimal, l'arbre quand la sortie est du JSON, et la différence avec
 * l'entrée. Une sortie HTML (tableaux, graphiques) est assainie avant d'être
 * affichée. Copie et téléchargement dans l'en-tête.
 */
import { NAlert, NButton, NSpin } from 'naive-ui';
import { useCopy } from '@/composable/copy';
import { type BakeResult, chefClient } from '~/integrations/cyberchef/chef-client';
import CodeView from '~/integrations/cyberchef/components/CodeView.vue';
import JsonTree from '~/integrations/cyberchef/components/JsonTree.vue';
import { hexdump, lineDiff, parseJson } from '~/integrations/cyberchef/data-view';
import { decodeOutput, downloadBytes, formatBytes, sanitizeHtml } from '~/integrations/cyberchef/output';

const props = withDefaults(defineProps<{
  result?: BakeResult;
  busy: boolean;
  /** Le calcul dure : on affiche l'état du worker et un bouton d'annulation. */
  slow: boolean;
  /**
   * L'entrée est vide : une erreur n'apprendrait rien à l'utilisateur
   * (« Unexpected end of JSON input » avant même d'avoir tapé), on la tait.
   */
  inputEmpty: boolean;
  /** Titre de l'erreur, ex. « Étape 2 — From Hex ». Générique à défaut. */
  errorTitle?: string;
  /** Avertissement au-dessus de la sortie, ex. recette arrêtée à une étape. */
  warning?: string;
  /** Nom de base des fichiers téléchargés. */
  filename: string;
  /** L'entrée en texte, pour la vue « diff » ; absente quand l'entrée est un fichier. */
  source?: string;
  variant?: 'card' | 'pane';
}>(), {
  result: undefined,
  errorTitle: undefined,
  warning: undefined,
  source: undefined,
  variant: 'card',
});

const { t } = useI18n();
const titleId = useId();

const decoded = computed(() => (props.result?.bytes ? decodeOutput(props.result.bytes) : undefined));
const html = computed(() => (props.result?.html ? sanitizeHtml(props.result.html) : undefined));
const outputText = computed(() => decoded.value?.text ?? '');
const visibleError = computed(() => (props.inputEmpty ? undefined : props.result?.error));

const { copy } = useCopy({ source: outputText, text: t('app.cc.copied') });

function download() {
  if (props.result?.html) {
    downloadBytes(props.result.html, `${props.filename}.html`, 'text/html');
  }
  else if (props.result?.bytes) {
    downloadBytes(props.result.bytes, `${props.filename}.${decoded.value?.binary ? 'bin' : 'txt'}`);
  }
}

// --- Vues ----------------------------------------------------------------------

type Tab = 'raw' | 'hex' | 'tree' | 'diff';
const TABS: Tab[] = ['raw', 'hex', 'tree', 'diff'];
const tab = ref<Tab>('raw');

const json = computed(() => (html.value || decoded.value?.binary ? undefined : parseJson(outputText.value)));

/** Pourquoi une vue n'est pas proposée ; `undefined` si elle l'est. */
const unavailable = computed<Record<Tab, string | undefined>>(() => ({
  raw: undefined,
  hex: props.result?.bytes ? undefined : t('app.cc.noBytes'),
  tree: json.value ? undefined : t('app.cc.notJson'),
  diff: props.source === undefined || html.value ? t('app.cc.diffNeedsText') : undefined,
}));

// Une vue devenue sans objet (la sortie n'est plus du JSON) rend la main au brut.
watch(unavailable, (reasons) => {
  if (reasons[tab.value]) tab.value = 'raw';
});

const hex = computed(() => (tab.value === 'hex' && props.result?.bytes ? hexdump(new Uint8Array(props.result.bytes)) : undefined));
const diff = computed(() => (tab.value === 'diff' && props.source !== undefined ? lineDiff(props.source, outputText.value) : undefined));
const diffSign = { same: ' ', added: '+', removed: '-' } as const;

function onTabKey(event: KeyboardEvent) {
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!delta) return;
  event.preventDefault();
  const available = TABS.filter(id => !unavailable.value[id]);
  tab.value = available[(available.indexOf(tab.value) + delta + available.length) % available.length];
  nextTick(() => (event.currentTarget as HTMLElement | null)?.parentElement?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
}
</script>

<template>
  <section class="io-panel cc-output" :class="`io-panel--${variant}`" :aria-labelledby="titleId" :aria-busy="busy">
    <header class="io-head">
      <h2 :id="titleId" class="io-title ct-mono">
        {{ t('app.cc.output') }}
      </h2>
      <span v-if="result && !result.error" class="io-meta ct-mono">
        {{ result.html ? 'HTML' : formatBytes(decoded?.size ?? 0) }} · {{ result.duration }} ms
      </span>

      <div class="io-tabs" role="tablist" :aria-label="t('app.cc.outputView')">
        <button
          v-for="id in TABS"
          :key="id"
          type="button"
          class="io-tab"
          role="tab"
          :aria-selected="tab === id"
          :tabindex="tab === id ? 0 : -1"
          :disabled="Boolean(unavailable[id])"
          :title="unavailable[id]"
          @click="tab = id"
          @keydown="onTabKey"
        >
          {{ t(`app.cc.tabs.${id}`) }}
        </button>
      </div>

      <div class="io-actions">
        <button type="button" class="io-action" :aria-label="t('app.cc.copy')" :title="t('app.cc.copy')" :disabled="!outputText" @click="copy()">
          <icon-mdi-content-copy aria-hidden="true" />
        </button>
        <button type="button" class="io-action" :aria-label="t('app.cc.download')" :title="t('app.cc.download')" :disabled="!result?.bytes && !result?.html" @click="download">
          <icon-mdi-download aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="slow" class="state">
      <NSpin size="small" />
      <span>{{ chefClient.status.value || t('app.cc.running') }}</span>
      <NButton size="tiny" quaternary @click="chefClient.cancel()">
        {{ t('app.cc.cancel') }}
      </NButton>
    </div>

    <div class="io-body" role="tabpanel" :aria-label="t(`app.cc.tabs.${tab}`)">
      <NAlert v-if="visibleError" type="error" :title="errorTitle || t('app.cc.opError')" class="alert op-error">
        <pre class="error-text">{{ visibleError }}</pre>
      </NAlert>

      <template v-else-if="result?.error" />

      <!-- eslint-disable-next-line vue/no-v-html — assaini par DOMPurify -->
      <div v-else-if="html" class="html-output" v-html="html" />

      <template v-else-if="tab === 'raw'">
        <NAlert v-if="warning && !inputEmpty" type="warning" class="alert stopped-notice" :show-icon="false">
          {{ warning }}
        </NAlert>
        <NAlert v-if="decoded?.binary" type="warning" class="alert binary-notice" :show-icon="false">
          {{ t('app.cc.binary', { size: formatBytes(decoded.size) }) }}
        </NAlert>
        <CodeView
          :value="outputText"
          readonly
          gutter="offsets"
          :label="t('app.cc.output')"
          :placeholder="t('app.cc.outputPlaceholder')"
        />
        <p v-if="decoded?.truncated" class="io-note">
          {{ t('app.cc.truncated', { size: formatBytes(decoded.size) }) }}
        </p>
      </template>

      <template v-else-if="tab === 'hex'">
        <pre class="io-pre ct-mono">{{ hex?.text }}</pre>
        <p v-if="hex?.truncated" class="io-note">
          {{ t('app.cc.hexTruncated', { size: formatBytes(64 * 1024) }) }}
        </p>
      </template>

      <div v-else-if="tab === 'tree' && json" class="tree">
        <JsonTree :value="json.value" />
      </div>

      <template v-else-if="tab === 'diff'">
        <pre v-if="diff" class="io-pre diff ct-mono"><span
          v-for="(line, index) in diff"
          :key="index"
          class="diff-line"
          :class="`diff-line--${line.kind}`"
        >{{ diffSign[line.kind] }} {{ line.text }}</span></pre>
        <p v-else class="io-note">
          {{ t('app.cc.diffTooLarge') }}
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped src="./io-panel.css"></style>

<style scoped>
.state {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--ct-border);
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
}

.alert {
  flex-shrink: 0;
  margin: 8px 12px 0;
}

.io-body > .alert:last-of-type {
  margin-bottom: 8px;
}

.error-text {
  margin: 0;
  white-space: pre-wrap;
  font-family: var(--ct-font-mono);
  font-size: 12px;
}

/* Page d'opération : une sortie HTML (tableau, graphique) prend la hauteur qu'il lui faut. */
.io-panel--card .io-body:has(.html-output) {
  height: auto;
  max-height: 520px;
}

.tree {
  flex: 1;
  min-height: 0;
  padding: 8px 12px;
  overflow: auto;
}

.diff-line {
  display: block;
  white-space: pre;
}

.diff-line--added {
  background: color-mix(in srgb, var(--ct-success) 14%, transparent);
}

.diff-line--removed {
  background: color-mix(in srgb, var(--ct-error) 14%, transparent);
}

/* Sorties HTML de CyberChef : tableaux, rendus d'image, graphiques. */
.html-output {
  flex: 1;
  min-height: 0;
  padding: 8px 12px;
  overflow: auto;
  font-size: 13px;
}

.html-output :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.html-output :deep(th),
.html-output :deep(td) {
  border: 1px solid var(--ct-border);
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}

.html-output :deep(img),
.html-output :deep(svg) {
  max-width: 100%;
  height: auto;
}

.html-output :deep(pre) {
  font-family: var(--ct-font-mono);
  white-space: pre-wrap;
}

/*
 * Les graphiques de CyberChef codent leurs couleurs en dur (« blue »,
 * « steelblue »), qui détonnent avec notre palette et contrastent mal en thème
 * sombre.
 */
.html-output :deep(svg [fill='blue']),
.html-output :deep(svg [fill='steelblue']) {
  fill: var(--ct-primary);
}

.html-output :deep(svg [stroke='blue']),
.html-output :deep(svg [stroke='steelblue']) {
  stroke: var(--ct-primary);
}
</style>
