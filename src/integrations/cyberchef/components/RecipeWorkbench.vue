<script setup lang="ts">
/**
 * L'atelier de recettes : enchaîner des opérations CyberChef, voir le résultat
 * en direct, lancer Magic, partager ou importer une recette au format de
 * CyberChef.
 *
 * Trois panneaux pleine hauteur, redimensionnables : les opérations, la
 * recette, l'entrée et la sortie. Chacun défile seul ; leurs largeurs sont
 * mémorisées. En dessous de 1000 px, ils s'empilent.
 */
import { useDebounceFn, useEventListener } from '@vueuse/core';
import { NAlert, NButton, NCheckbox, NModal, NSwitch } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import { useCopy } from '@/composable/copy';
import type { RecipeStep } from '~/catalog/tool.types';
import PaneResizer from '~/components/PaneResizer.vue';
import { chefClient, utf8Length } from '~/integrations/cyberchef/chef-client';
import CcInput, { type InputFile } from '~/integrations/cyberchef/components/CcInput.vue';
import CcOutput from '~/integrations/cyberchef/components/CcOutput.vue';
import MagicPanel from '~/integrations/cyberchef/components/MagicPanel.vue';
import RecipeOpsPane from '~/integrations/cyberchef/components/RecipeOpsPane.vue';
import RecipeStepCard from '~/integrations/cyberchef/components/RecipeStepCard.vue';
import { type OperationConfig, completeArgs, loadOperationConfig } from '~/integrations/cyberchef/operations';
import { isRecipeOperation } from '~/integrations/cyberchef/recipe-operations';
import { buildFragment, looksLikeLink, parseLink } from '~/integrations/cyberchef/recipe-link';
import { formatBytes } from '~/integrations/cyberchef/output';
import { useBaker } from '~/integrations/cyberchef/use-baker';
import { type WorkbenchStep, toRecipe, toWorkbenchStep, useRecipeStore } from '~/stores/recipe';
import { useSessionStore } from '~/stores/session';
import { useSettingsStore } from '~/stores/settings';

const CYBERCHEF_URL = 'https://gchq.github.io/CyberChef/';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useRecipeStore();
const { steps, input, saved } = storeToRefs(store);
const { settings } = storeToRefs(useSettingsStore());
const { networkRequests } = storeToRefs(useSessionStore());

const file = ref<InputFile>();
const configs = ref<Record<string, OperationConfig>>();
/**
 * Toute étape passe par prepare(), qui a besoin de la configuration des
 * opérations : sans elle, chacune serait écartée comme inconnue. Ajouter,
 * reprendre ou importer avant la fin du chargement attend donc qu'elle arrive.
 */
const configsReady = loadOperationConfig().then((loaded) => {
  configs.value = loaded;
  return loaded;
});
const notices = ref<{ type: 'warning' | 'error'; text: string }[]>([]);
const showMagic = ref(false);
const { result, busy, slow, bake } = useBaker();
const { copy } = useCopy({ createToast: true, text: t('app.recipes.copied') });

// --- Composition de la recette ----------------------------------------------

/**
 * Transforme une recette importée en étapes de l'atelier : opérations écartées
 * ou inconnues retirées (et signalées), arguments manquants complétés.
 */
function prepare(recipe: RecipeStep[]): WorkbenchStep[] {
  const dropped: string[] = [];
  const prepared: WorkbenchStep[] = [];

  for (const step of recipe) {
    const config = configs.value?.[step.op];
    if (!config || !isRecipeOperation(step.op)) {
      dropped.push(step.op);
      continue;
    }
    prepared.push({ ...toWorkbenchStep(step), args: completeArgs(config, step.args) });
  }

  if (dropped.length) {
    notices.value.push({ type: 'warning', text: t('app.recipes.dropped', { names: [...new Set(dropped)].join(', ') }) });
  }
  return prepared;
}

async function add(name: string) {
  await configsReady;
  steps.value = [...steps.value, ...prepare([{ op: name, args: [] }])];
}

/** Maj+Entrée : la recette devient cette seule opération (« Reprendre » la rend). */
function replaceWith(name: string) {
  replace([{ op: name, args: [] }]);
}

async function append(recipe: RecipeStep[]) {
  await configsReady;
  steps.value = [...steps.value, ...prepare(recipe)];
}

async function replace(recipe: RecipeStep[], withInput?: string) {
  await configsReady;
  notices.value = [];
  steps.value = prepare(recipe);
  if (withInput !== undefined) {
    input.value = withInput;
    file.value = undefined;
  }
}

function updateStep(index: number, patch: Partial<WorkbenchStep>) {
  steps.value = steps.value.map((step, i) => (i === index ? { ...step, ...patch } : step));
}

function move(index: number, delta: -1 | 1) {
  const next = [...steps.value];
  const [step] = next.splice(index, 1);
  next.splice(index + delta, 0, step);
  steps.value = next;
}

function remove(index: number) {
  steps.value = steps.value.filter((_, i) => i !== index);
}

function resume() {
  replace(saved.value);
}

function clear() {
  steps.value = [];
  notices.value = [];
}

const allCollapsed = computed(() => steps.value.length > 0 && steps.value.every(step => step.collapsed));

function toggleAll() {
  const collapsed = !allCollapsed.value;
  steps.value = steps.value.map(step => ({ ...step, collapsed }));
}

// --- Panneaux ---------------------------------------------------------------

const opsWidth = ref(settings.value.recipesOpsWidth);
const stepsWidth = ref(settings.value.recipesStepsWidth);
// Enregistré une fois le geste fini, pas à chaque pixel.
const saveWidths = useDebounceFn(() => {
  settings.value.recipesOpsWidth = opsWidth.value;
  settings.value.recipesStepsWidth = stepsWidth.value;
}, 300);
watch([opsWidth, stepsWidth], saveWidths);

// --- Import --------------------------------------------------------------

async function importText(text: string) {
  notices.value = [];
  let recipeText = text.trim();
  let linkedInput: string | undefined;

  if (looksLikeLink(recipeText)) {
    const link = parseLink(recipeText);
    recipeText = link.recipe ?? '';
    linkedInput = link.input;
  }

  try {
    const recipe = recipeText ? await chefClient.parseRecipe(recipeText) : [];
    await replace(recipe, linkedInput);
    return true;
  }
  catch (error) {
    notices.value.push({ type: 'error', text: t('app.recipes.invalid', { message: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

// --- Calcul ----------------------------------------------------------------

const recipe = computed(() => toRecipe(steps.value));

function run() {
  if (!configs.value) return;
  bake(file.value?.buffer ?? input.value, recipe.value);
}

const runSoon = useDebounceFn(run, 300);
watch([steps, input, file], () => {
  if (settings.value.autoBake) runSoon();
}, { deep: true });

/** Étape fautive : erreur levée, ou erreur d'opération qui a arrêté la recette. */
const failedStep = computed(() => (result.value?.error ? result.value.failedStep : result.value?.stoppedAt));

function stepTitle(key: string) {
  const index = failedStep.value;
  const step = index !== undefined ? steps.value[index] : undefined;
  return step ? t(key, { index: index! + 1, name: step.op }) : undefined;
}

// --- Pieds de panneau ----------------------------------------------------------

const activeSteps = computed(() => steps.value.filter(step => !step.disabled).length);
const ignoredSteps = computed(() => steps.value.length - activeSteps.value);
const inputBytes = computed(() => (file.value ? file.value.size : utf8Length(input.value)));
const outputBytes = computed(() => result.value?.bytes?.byteLength ?? (result.value?.html ? utf8Length(result.value.html) : 0));

/** État de la dernière exécution, pour le bandeau du bas. */
const runState = computed<'busy' | 'idle' | 'failed' | 'done'>(() => {
  if (busy.value) return 'busy';
  if (!result.value || (!file.value && input.value === '')) return 'idle';
  return result.value.error || result.value.stoppedAt !== undefined ? 'failed' : 'done';
});
const RUN_LABEL = { busy: 'app.recipes.runBusy', idle: 'app.recipes.runIdle', failed: 'app.recipes.runFailed', done: 'app.recipes.runDone' } as const;

const errorTitle = computed(() => (result.value?.error ? stepTitle('app.recipes.failedAt') : undefined));
const stoppedWarning = computed(() => (result.value?.stoppedAt !== undefined ? stepTitle('app.recipes.stoppedAt') : undefined));

// --- Adresse et partage ------------------------------------------------------

/**
 * L'adresse reflète la recette (jamais l'entrée) : la recopier suffit à la
 * partager, et elle s'ouvre aussi sur cyberchef.org.
 *
 * On lit et on écrit le fragment brut, sans passer par vue-router : route.hash
 * est déjà décodé (le « + » littéral d'un alphabet base64 y deviendrait une
 * espace au second décodage), et router.replace() ré-encoderait un fragment
 * déjà encodé. CyberChef lit lui aussi l'adresse brute, pour la même raison.
 */
function rawHash() {
  const fragment = window.location.href.split('#')[1];
  return fragment ? `#${fragment}` : '';
}

let writtenHash = '';

const syncHash = useDebounceFn(async () => {
  const fragment = steps.value.length ? buildFragment({ recipe: await chefClient.prettyRecipe(recipe.value) }) : '';
  writtenHash = fragment ? `#${fragment}` : '';
  if (rawHash() !== writtenHash) {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${writtenHash}`);
  }
}, 400);

watch(steps, () => {
  if (configs.value) syncHash();
}, { deep: true });

// Un lien suivi depuis la page (sortie HTML de Magic, adresse modifiée à la main).
useEventListener(window, 'hashchange', async () => {
  const hash = rawHash();
  if (!configs.value || !hash || hash === writtenHash) return;
  const link = parseLink(hash);
  if (link.recipe !== undefined || link.input !== undefined) {
    writtenHash = hash;
    await importText(hash);
  }
});

const shareOpen = ref(false);
const shareWithInput = ref(false);
const shareRecipe = ref('');

const shareLink = computed(() => {
  const fragment = buildFragment({ recipe: shareRecipe.value, input: shareWithInput.value ? input.value : undefined });
  return `${window.location.origin}${router.resolve({ path: route.path }).href}${fragment ? `#${fragment}` : ''}`;
});
const cyberchefLink = computed(() => `${CYBERCHEF_URL}#${buildFragment({ recipe: shareRecipe.value })}`);

async function openShare() {
  shareRecipe.value = await chefClient.prettyRecipe(recipe.value);
  shareOpen.value = true;
}

const importOpen = ref(false);
const importDraft = ref('');

async function confirmImport() {
  if (await importText(importDraft.value)) {
    importOpen.value = false;
    importDraft.value = '';
  }
}

// --- Démarrage ----------------------------------------------------------------

onMounted(async () => {
  await configsReady;

  // Une recette déposée par un autre outil, ou un lien. Sinon l'atelier s'ouvre
  // vide, la dernière recette restant à portée de « Reprendre » — ou rouverte
  // d'office si l'utilisateur l'a choisi dans les paramètres.
  const handoff = store.takeHandoff();
  const initialHash = rawHash();
  const link = initialHash ? parseLink(initialHash) : {};

  if (handoff) {
    await replace(handoff.steps, handoff.input);
  }
  else if (link.recipe !== undefined || link.input !== undefined) {
    writtenHash = initialHash;
    await importText(initialHash);
  }
  else {
    steps.value = settings.value.recipesRestoreLast ? prepare(saved.value) : [];
  }

  syncHash();
  run();
});
</script>

<template>
  <div class="workbench" :style="{ '--ops-width': `${opsWidth}px`, '--steps-width': `${stepsWidth}px` }">
    <!-- Les actions de l'atelier montent dans la barre du haut, avant l'étoile. -->
    <Teleport defer to="#ct-topbar-actions">
      <div class="workbench-actions">
        <c-button size="small" :type="showMagic ? 'primary' : 'default'" :aria-pressed="showMagic" aria-label="Magic" @click="showMagic = !showMagic">
          <icon-mdi-auto-fix class="button-icon" aria-hidden="true" />
          <span class="action-label">Magic</span>
        </c-button>
        <c-button size="small" :aria-label="t('app.recipes.import')" @click="importOpen = true">
          <icon-mdi-import class="button-icon" aria-hidden="true" />
          <span class="action-label">{{ t('app.recipes.import') }}</span>
        </c-button>
        <c-button size="small" :disabled="!steps.length" :aria-label="t('app.recipes.share')" @click="openShare">
          <icon-mdi-share-variant-outline class="button-icon" aria-hidden="true" />
          <span class="action-label">{{ t('app.recipes.share') }}</span>
        </c-button>
        <label class="auto-bake" :title="t('app.recipes.autoBakeHelp')">
          <NSwitch v-model:value="settings.autoBake" size="small" class="auto-bake-switch" />
          <span class="ct-mono">{{ t('app.recipes.autoBake') }}</span>
        </label>
      </div>
    </Teleport>

    <section class="pane pane--ops" :aria-label="t('app.recipes.operations')">
      <RecipeOpsPane @add="add" @replace="replaceWith" />
    </section>

    <PaneResizer v-model="opsWidth" :min="180" :max="400" :label="t('app.recipes.resizeOps')" class="pane-resizer" />

    <section class="pane pane--recipe" aria-labelledby="pane-recipe">
      <div class="pane-scroll">
        <header class="pane-head">
          <h2 id="pane-recipe" class="pane-label ct-mono">
            {{ t('app.recipes.recipe') }}
          </h2>
          <div v-if="steps.length" class="pane-tools ct-mono">
            <button type="button" class="link-button" @click="toggleAll">
              {{ allCollapsed ? t('app.recipes.expandAll') : t('app.recipes.collapseAll') }}
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" class="link-button recipe-clear" @click="clear">
              {{ t('app.recipes.clear') }}
            </button>
          </div>
        </header>

        <NAlert
          v-for="(notice, index) in notices"
          :key="index"
          :type="notice.type"
          closable
          class="notice"
          @close="notices.splice(index, 1)"
        >
          {{ notice.text }}
        </NAlert>

        <c-card v-if="showMagic" :title="t('app.magic.panelTitle')" class="magic-card">
          <p class="magic-intro">
            {{ steps.length ? t('app.magic.introWithRecipe') : t('app.magic.intro') }}
          </p>
          <MagicPanel :input="file?.buffer ?? input" :prefix="recipe" :apply-label="t('app.magic.addToRecipe')" @apply="append" />
        </c-card>

        <draggable
          v-if="steps.length"
          v-model="steps"
          item-key="uid"
          handle=".drag-handle"
          class="steps"
          :animation="150"
        >
          <template #item="{ element, index }">
            <RecipeStepCard
              :step="element"
              :index="index"
              :count="steps.length"
              :config="configs?.[element.op]"
              :failed="failedStep === index"
              @update:args="(args: unknown[]) => updateStep(index, { args })"
              @toggle-disabled="updateStep(index, { disabled: !element.disabled })"
              @toggle-collapsed="updateStep(index, { collapsed: !element.collapsed })"
              @move="(delta: -1 | 1) => move(index, delta)"
              @remove="remove(index)"
            />
          </template>
        </draggable>

        <div v-else class="empty">
          <icon-mdi-chef-hat class="empty-icon" aria-hidden="true" />
          <p class="empty-title">
            {{ t('app.recipes.emptyTitle') }}
          </p>
          <p class="empty-text">
            {{ t('app.recipes.emptyText') }}
          </p>
          <c-button v-if="saved.length" class="resume" @click="resume">
            <icon-mdi-history class="button-icon" aria-hidden="true" />
            {{ t('app.recipes.resume', { count: saved.length }, saved.length) }}
          </c-button>
        </div>
      </div>

      <footer class="pane-foot ct-mono">
        <span class="run-state" :class="`run-state--${runState}`">
          <span class="run-dot" aria-hidden="true" />
          {{ t('app.recipes.stepCount', activeSteps) }}
        </span>
        <span>{{ t('app.recipes.ignoredCount', ignoredSteps) }}</span>
      </footer>
    </section>

    <PaneResizer v-model="stepsWidth" :min="300" :max="640" :label="t('app.recipes.resizeSteps')" class="pane-resizer" />

    <section class="pane pane--io io-column" :aria-label="t('app.recipes.io')">
      <CcInput v-model:input="input" v-model:file="file" variant="pane" :manual="!settings.autoBake" :running="busy" @run="run" />
      <CcOutput
        variant="pane"
        :result="result"
        :busy="busy"
        :slow="slow"
        :input-empty="!file && input === ''"
        :error-title="errorTitle"
        :warning="stoppedWarning"
        :source="file ? undefined : input"
        filename="recette"
      />

      <!-- Bandeau d'exécution : ce que la recette vient de faire, mesuré. -->
      <footer class="pane-foot run-banner ct-mono">
        <span class="run-state" :class="`run-state--${runState}`">
          <span class="run-dot" aria-hidden="true" />
          {{ t(RUN_LABEL[runState]) }}
        </span>
        <template v-if="result && (runState === 'done' || runState === 'failed')">
          <span>{{ formatBytes(inputBytes) }} → {{ formatBytes(outputBytes) }}</span>
          <span>{{ result.duration }} ms</span>
          <span>{{ t('app.recipes.stepCount', activeSteps) }} · {{ t('app.recipes.errorCount', runState === 'failed' ? 1 : 0) }}</span>
        </template>
        <span class="run-network" :title="t('app.status.networkNone')">
          <span class="run-dot" :class="networkRequests ? 'run-dot--warning' : 'run-dot--live'" aria-hidden="true" />
          {{ t('app.status.network', networkRequests) }}
        </span>
      </footer>
    </section>

    <NModal v-model:show="shareOpen" preset="card" :title="t('app.recipes.shareTitle')" class="dialog">
      <div class="share">
        <label class="share-label">{{ t('app.recipes.shareLink') }}</label>
        <c-input-text :value="shareLink" readonly multiline rows="3" raw-text class="mono" />
        <NCheckbox v-model:checked="shareWithInput" :disabled="!input">
          {{ t('app.recipes.includeInput') }}
        </NCheckbox>
        <p v-if="shareWithInput" class="share-warning">
          {{ t('app.recipes.includeInputWarning') }}
        </p>
        <div class="share-actions">
          <c-button type="primary" @click="copy(shareLink)">
            {{ t('app.recipes.copyLink') }}
          </c-button>
          <c-button @click="copy(shareRecipe)">
            {{ t('app.recipes.copyRecipe') }}
          </c-button>
          <c-button @click="copy(JSON.stringify(recipe))">
            {{ t('app.recipes.copyJson') }}
          </c-button>
          <NButton tag="a" :href="cyberchefLink" target="_blank" rel="noopener noreferrer" quaternary>
            {{ t('app.recipes.openInCyberChef') }}
          </NButton>
        </div>
        <p class="share-note">
          {{ t('app.recipes.shareNote') }}
        </p>
      </div>
    </NModal>

    <NModal v-model:show="importOpen" preset="card" :title="t('app.recipes.importTitle')" class="dialog">
      <div class="share">
        <p class="share-note">
          {{ t('app.recipes.importHelp') }}
        </p>
        <c-input-text
          v-model:value="importDraft"
          multiline
          rows="6"
          raw-text
          :placeholder="t('app.recipes.importPlaceholder')"
          class="mono"
        />
        <div class="share-actions">
          <c-button type="primary" :disabled="!importDraft.trim()" @click="confirmImport">
            {{ t('app.recipes.importConfirm') }}
          </c-button>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
/*
 * Trois panneaux pleine hauteur, entre la barre du haut et la barre d'état.
 * Les séparateurs sont des colonnes de 1 px : ils tracent aussi les filets.
 */
.workbench {
  display: grid;
  grid-template-columns: var(--ops-width) 1px var(--steps-width) 1px minmax(360px, 1fr);
  height: calc(100vh - var(--ct-topbar-height) - var(--ct-chrome-bottom));
  height: calc(100dvh - var(--ct-topbar-height) - var(--ct-chrome-bottom));
  font-size: var(--ct-font-size-ui);
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 12px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pane--ops {
  /* Le panneau gère lui-même son défilement : champ et raccourcis restent en place. */
  padding: 0;
  overflow: hidden;
  background: var(--ct-chassis);
}

/* Recette, entrée et sortie : une zone qui défile au-dessus d'un pied fixe. */
.pane--recipe,
.pane--io {
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.pane-scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 12px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pane--io .cc-output {
  border-top: 1px solid var(--ct-border);
}

/* Pieds de panneau, à la hauteur de la barre d'état : ils la remplacent ici. */
.pane-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  height: var(--ct-statusbar-height);
  padding: 0 12px;
  border-top: 1px solid var(--ct-border);
  background: var(--ct-chassis);
  color: var(--ct-text-faint);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
}

.pane-foot > * + *:not(.run-network) {
  padding-left: 12px;
  border-left: 1px solid var(--ct-border);
}

.run-state {
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ct-text-faint);
}

.run-state--done .run-dot {
  background: var(--ct-success);
}

.run-state--failed .run-dot {
  background: var(--ct-error);
}

.run-state--busy .run-dot {
  background: var(--ct-warning);
}

.run-dot--live {
  background: var(--ct-primary);
}

.run-dot--warning {
  background: var(--ct-warning);
}

.run-network {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.pane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.pane-label {
  margin: 0;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.pane-tools {
  display: flex;
  gap: 8px;
  color: var(--ct-text-faint);
  font-size: 11px;
  text-transform: lowercase;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ct-text-faint);
  font: inherit;
  cursor: pointer;
}

.link-button:hover {
  color: var(--ct-primary);
}

/* Actions téléportées dans la barre du haut : avant l'étoile de l'outil. */
.workbench-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  order: -1;
}

.auto-bake {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid var(--ct-border);
  color: var(--ct-text-muted);
  font-size: 12px;
  cursor: pointer;
}

/* Sous 1000 px : les panneaux s'empilent et la page défile, comme avant. */
@media (max-width: 999.98px) {
  .workbench {
    display: flex;
    flex-direction: column;
    height: auto;
  }

  .pane {
    overflow: visible;
    padding: 16px;
  }

  .pane-scroll {
    overflow: visible;
    padding: 16px;
  }

  /* Empilé, le panneau des opérations garde une hauteur bornée. */
  .pane--ops {
    height: 360px;
    padding: 0;
    overflow: hidden;
  }

  .pane-resizer {
    display: none;
  }
}

/* Téléphone : les actions de la barre du haut en icônes seules. */
@media (max-width: 639.98px) {
  .action-label,
  .auto-bake span {
    display: none;
  }

  .workbench-actions .button-icon {
    margin-right: 0;
  }

  .auto-bake {
    padding-left: 8px;
  }
}

.button-icon {
  margin-right: 6px;
}

.notice {
  margin: 0;
}

.magic-intro {
  margin: 0 0 12px;
  color: var(--ct-text-muted);
  font-size: 13px;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty {
  padding: 36px 20px;
  text-align: center;
  border: 1px dashed var(--ct-border);
  border-radius: var(--ct-radius-large);
}

.resume {
  margin-top: 16px;
}

.empty-icon {
  font-size: 32px;
  color: var(--ct-primary);
}

.empty-title {
  margin: 8px 0 4px;
  font-weight: 600;
}

.empty-text {
  margin: 0 auto;
  max-width: 44ch;
  color: var(--ct-text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.share {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.share-label {
  font-size: 13px;
  color: var(--ct-text-muted);
}

.share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-warning {
  margin: 0;
  font-size: 13px;
  color: var(--ct-warning);
}

.share-note {
  margin: 0;
  font-size: 13px;
  color: var(--ct-text-muted);
  line-height: 1.5;
}

.mono :deep(.input-wrapper) {
  font-family: var(--ct-font-mono);
  font-size: 12px;
}

:global(.dialog) {
  width: min(620px, calc(100vw - 24px));
}
</style>
