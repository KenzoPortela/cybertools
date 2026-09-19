<script setup lang="ts">
/**
 * Panneau de sortie d'une opération ou d'une recette : texte (binaire signalé),
 * ou HTML assaini ; copie et téléchargement.
 */
import { NAlert, NButton, NSpin } from 'naive-ui';
import { useCopy } from '@/composable/copy';
import { type BakeResult, chefClient } from '~/integrations/cyberchef/chef-client';
import { decodeOutput, downloadBytes, formatBytes, sanitizeHtml } from '~/integrations/cyberchef/output';

const props = defineProps<{
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
}>();

const { t } = useI18n();

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
</script>

<template>
  <c-card :title="t('app.cc.output')" class="cc-output" :aria-busy="busy">
    <div v-if="slow" class="state">
      <NSpin size="small" />
      <span>{{ chefClient.status.value || t('app.cc.running') }}</span>
      <NButton size="tiny" quaternary @click="chefClient.cancel()">
        {{ t('app.cc.cancel') }}
      </NButton>
    </div>

    <NAlert v-if="visibleError" type="error" :title="errorTitle || t('app.cc.opError')" class="alert op-error">
      <pre class="error-text">{{ visibleError }}</pre>
    </NAlert>

    <template v-else-if="result?.error" />

    <!-- eslint-disable-next-line vue/no-v-html — assaini par DOMPurify -->
    <div v-else-if="html" class="html-output" v-html="html" />

    <template v-else>
      <NAlert v-if="warning && !inputEmpty" type="warning" class="alert stopped-notice" :show-icon="false">
        {{ warning }}
      </NAlert>
      <NAlert v-if="decoded?.binary" type="warning" class="alert binary-notice" :show-icon="false">
        {{ t('app.cc.binary', { size: formatBytes(decoded.size) }) }}
      </NAlert>
      <c-input-text
        :value="outputText"
        multiline
        rows="10"
        readonly
        raw-text
        :placeholder="t('app.cc.outputPlaceholder')"
        class="mono"
      />
      <p v-if="decoded?.truncated" class="hint">
        {{ t('app.cc.truncated', { size: formatBytes(decoded.size) }) }}
      </p>
    </template>

    <div class="actions">
      <c-button :disabled="!outputText" @click="copy()">
        <icon-mdi-content-copy class="button-icon" aria-hidden="true" />
        {{ t('app.cc.copy') }}
      </c-button>
      <c-button :disabled="!result?.bytes && !result?.html" @click="download">
        <icon-mdi-download class="button-icon" aria-hidden="true" />
        {{ t('app.cc.download') }}
      </c-button>
      <span v-if="result && !result.error" class="meta">
        {{ result.html ? 'HTML' : formatBytes(decoded?.size ?? 0) }} · {{ result.duration }} ms
      </span>
    </div>
  </c-card>
</template>

<style scoped>
.cc-output {
  min-width: 0;
}

/* Sur le conteneur : leur textarea impose « font-family: inherit » avec un sélecteur plus fort. */
.mono :deep(.input-wrapper) {
  font-family: var(--ct-font-mono);
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.button-icon {
  margin-right: 6px;
}

.meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--ct-text-muted);
  font-variant-numeric: tabular-nums;
}

.state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--ct-text-muted);
}

.alert {
  margin-bottom: 10px;
}

.error-text {
  margin: 0;
  white-space: pre-wrap;
  font-family: var(--ct-font-mono);
  font-size: 12px;
}

.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}

/* Sorties HTML de CyberChef : tableaux, rendus d'image, graphiques. */
.html-output {
  max-height: 520px;
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
