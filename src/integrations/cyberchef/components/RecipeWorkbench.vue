<script setup lang="ts">
/**
 * L'atelier de recettes : enchaîner des opérations CyberChef, voir le résultat
 * en direct, lancer Magic, partager ou importer une recette au format de
 * CyberChef.
 */
import { useDebounceFn, useEventListener } from '@vueuse/core';
import { NAlert, NButton, NCheckbox, NModal } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import { useCopy } from '@/composable/copy';
import type { RecipeStep } from '~/catalog/tool.types';
import { chefClient } from '~/integrations/cyberchef/chef-client';
import CcInput, { type InputFile } from '~/integrations/cyberchef/components/CcInput.vue';
import CcOutput from '~/integrations/cyberchef/components/CcOutput.vue';
import MagicPanel from '~/integrations/cyberchef/components/MagicPanel.vue';
import RecipeOpPicker from '~/integrations/cyberchef/components/RecipeOpPicker.vue';
import RecipeStepCard from '~/integrations/cyberchef/components/RecipeStepCard.vue';
import { type OperationConfig, completeArgs, loadOperationConfig } from '~/integrations/cyberchef/operations';
import { isRecipeOperation } from '~/integrations/cyberchef/recipe-operations';
import { buildFragment, looksLikeLink, parseLink } from '~/integrations/cyberchef/recipe-link';
import { useBaker } from '~/integrations/cyberchef/use-baker';
import { type WorkbenchStep, toRecipe, toWorkbenchStep, useRecipeStore } from '~/stores/recipe';
import { useSettingsStore } from '~/stores/settings';

const CYBERCHEF_URL = 'https://gchq.github.io/CyberChef/';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useRecipeStore();
const { steps, input, saved } = storeToRefs(store);
const { settings } = storeToRefs(useSettingsStore());

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
  <div class="workbench">
    <div class="recipe-column">
      <div class="toolbar">
        <RecipeOpPicker class="picker" @add="add" />
        <div class="toolbar-actions">
          <c-button :type="showMagic ? 'primary' : 'default'" @click="showMagic = !showMagic">
            <icon-mdi-auto-fix class="button-icon" aria-hidden="true" />
            Magic
          </c-button>
          <c-button @click="importOpen = true">
            <icon-mdi-import class="button-icon" aria-hidden="true" />
            {{ t('app.recipes.import') }}
          </c-button>
          <c-button :disabled="!steps.length" @click="openShare">
            <icon-mdi-share-variant-outline class="button-icon" aria-hidden="true" />
            {{ t('app.recipes.share') }}
          </c-button>
          <c-button variant="text" :disabled="!steps.length" @click="clear">
            {{ t('app.recipes.clear') }}
          </c-button>
        </div>
      </div>

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

    <div class="io-column">
      <CcInput v-model:input="input" v-model:file="file" :manual="!settings.autoBake" :running="busy" @run="run" />
      <CcOutput
        :result="result"
        :busy="busy"
        :slow="slow"
        :input-empty="!file && input === ''"
        :error-title="errorTitle"
        :warning="stoppedWarning"
        filename="recette"
      />
    </div>

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
.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  width: 100%;
}

@media (max-width: 1000px) {
  .workbench {
    grid-template-columns: minmax(0, 1fr);
  }
}

.recipe-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.io-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  position: sticky;
  /* Sous la barre du haut du châssis, avec une marge. */
  top: calc(var(--ct-topbar-height) + 16px);
}

@media (max-width: 1000px) {
  .io-column {
    position: static;
  }
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
