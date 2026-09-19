<script setup lang="ts">
/**
 * Magic : CyberChef essaie des décodages successifs sur l'entrée et classe les
 * pistes les plus prometteuses. On lit sa sortie brute (la liste JSON des
 * candidats) plutôt que le tableau HTML qu'il présente, pour l'afficher avec
 * nos composants et proposer d'appliquer chaque piste en un clic.
 */
import { useDebounceFn } from '@vueuse/core';
import { NAlert, NInputNumber, NRadioButton, NRadioGroup, NSpin, NSwitch } from 'naive-ui';
import type { RecipeStep } from '~/catalog/tool.types';
import type { BakeResult } from '~/integrations/cyberchef/chef-client';
import { useBaker } from '~/integrations/cyberchef/use-baker';
import { useSettingsStore } from '~/stores/settings';

interface MagicCandidate {
  recipe: RecipeStep[];
  data: string;
  languageScores?: { lang: string; probability: number }[];
  fileType?: { name: string; ext: string; mime: string } | null;
  isUTF8: boolean;
  entropy: number;
  matchesCrib?: boolean;
  /** Opérations qui s'appliqueraient encore au résultat de cette piste. */
  matchingOps?: { op: string }[];
}

const props = defineProps<{
  input: string | ArrayBuffer;
  /** Étapes déjà en place : Magic analyse leur sortie, pas l'entrée brute. */
  prefix?: RecipeStep[];
  /** Libellé du bouton d'application. */
  applyLabel?: string;
}>();

const emit = defineEmits<{ apply: [recipe: RecipeStep[]] }>();

const { t, locale } = useI18n();

// Valeurs de départ tirées des paramètres ; les changer ici ne vaut que pour
// cette session.
const { settings } = useSettingsStore();
const autoDepth = ref(settings.magicAutoDepth);
const depth = ref(settings.magicDepth);
const intensive = ref(settings.magicIntensive);
const extensiveLanguages = ref(false);
const crib = ref('');

const { result, busy, slow, bake } = useBaker();

const empty = computed(() => (typeof props.input === 'string' ? props.input === '' : props.input.byteLength === 0));

/**
 * Profondeur automatique : approfondissement progressif.
 *
 * Magic à la profondeur d renvoie des pistes de 0 à d opérations, classées, et
 * pour chacune les opérations qui s'appliqueraient encore à son résultat. On
 * essaie d = 1, 2, 3… tant qu'une piste coupée net par la profondeur (d
 * opérations) reste décodable : une couche attend encore d'être retirée. Sinon,
 * aller plus loin ne ferait que coûter. Le coût croît très vite avec la
 * profondeur ; on s'arrête aussi quand l'étage suivant risque de dépasser le
 * budget de temps.
 */
const AUTO_MAX_DEPTH = 6;
const AUTO_BUDGET_MS = 8000;
/** Facteur de coût estimé d'un étage au suivant. */
const GROWTH = 5;

const exploring = ref<number>();
const detected = ref<{ depth: number; limited: boolean }>();
let generation = 0;

function magicStep(level: number): RecipeStep {
  return { op: 'Magic', args: [level, intensive.value, extensiveLanguages.value, crib.value] };
}

function candidatesOf(outcome: BakeResult | undefined) {
  return Array.isArray(outcome?.raw) ? (outcome.raw as MagicCandidate[]) : [];
}

async function runAuto(run: number) {
  const started = performance.now();
  for (let level = 1; level <= AUTO_MAX_DEPTH; level++) {
    exploring.value = level;
    const stepStarted = performance.now();
    const outcome = await bake(props.input, [...(props.prefix ?? []), magicStep(level)]);
    // Une saisie plus récente a relancé Magic : ce parcours est caduc.
    if (run !== generation || !outcome) return;

    const found = candidatesOf(outcome);
    if (outcome.error || !found.length) {
      exploring.value = undefined;
      return;
    }
    const truncated = found.some(candidate => candidate.recipe.length === level && candidate.matchingOps?.length);
    const elapsed = performance.now() - started;
    const nextCost = (performance.now() - stepStarted) * GROWTH;
    const tooSlow = elapsed + nextCost > AUTO_BUDGET_MS;
    if (!truncated || level === AUTO_MAX_DEPTH || tooSlow) {
      detected.value = { depth: found[0].recipe.length, limited: truncated };
      exploring.value = undefined;
      return;
    }
  }
}

function run() {
  const current = ++generation;
  detected.value = undefined;
  exploring.value = undefined;
  if (empty.value) {
    result.value = undefined;
    return;
  }
  if (autoDepth.value) {
    runAuto(current);
  }
  else {
    bake(props.input, [...(props.prefix ?? []), magicStep(depth.value)]);
  }
}

const runSoon = useDebounceFn(run, 350);
watch(() => [props.input, props.prefix, autoDepth.value, depth.value, intensive.value, extensiveLanguages.value, crib.value], runSoon, { deep: true });
onMounted(run);
onBeforeUnmount(() => { generation++; });

/**
 * Magic propose parfois plusieurs fois la même piste, qui ne diffère que par un
 * argument (mode strict ou non, par exemple) et aboutit au même résultat : pour
 * l'utilisateur, ce sont des doublons. On garde la première, la mieux classée.
 */
const candidates = computed<MagicCandidate[]>(() => {
  if (!Array.isArray(result.value?.raw)) return [];
  const seen = new Set<string>();
  return (result.value.raw as MagicCandidate[])
    .filter((candidate) => {
      const key = `${candidate.recipe.map(step => step.op).join('>')}\u0000${candidate.data}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
});

const languageNames = computed(() => {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'language' });
  }
  catch {
    return undefined;
  }
});

function describe(candidate: MagicCandidate) {
  const hints: string[] = [];
  if (candidate.matchesCrib) hints.push(t('app.magic.matchesCrib'));
  if (candidate.fileType) hints.push(candidate.fileType.name);
  if (candidate.isUTF8) hints.push(t('app.magic.utf8'));
  hints.push(t('app.magic.entropy', { value: candidate.entropy.toFixed(2) }));
  const language = candidate.languageScores?.[0];
  if (language && language.probability > 0.5) {
    hints.push(languageNames.value?.of(language.lang) ?? language.lang);
  }
  return hints;
}

function label(candidate: MagicCandidate) {
  return candidate.recipe.length ? candidate.recipe.map(step => step.op).join(' → ') : t('app.magic.asIs');
}
</script>

<template>
  <div class="magic">
    <div class="options">
      <div class="option">
        <span>{{ t('app.magic.depth') }}</span>
        <NRadioGroup v-model:value="autoDepth" size="small" class="depth-mode">
          <NRadioButton :value="true">
            {{ t('app.magic.depthAuto') }}
          </NRadioButton>
          <NRadioButton :value="false">
            {{ t('app.magic.depthManual') }}
          </NRadioButton>
        </NRadioGroup>
        <NInputNumber v-if="!autoDepth" v-model:value="depth" :min="1" :max="10" size="small" class="depth" :aria-label="t('app.magic.depth')" />
      </div>
      <label class="option">
        <NSwitch v-model:value="intensive" size="small" />
        <span>{{ t('app.magic.intensive') }}</span>
      </label>
      <label class="option">
        <NSwitch v-model:value="extensiveLanguages" size="small" />
        <span>{{ t('app.magic.extensiveLanguages') }}</span>
      </label>
      <c-input-text v-model:value="crib" :placeholder="t('app.magic.cribPlaceholder')" raw-text class="crib" />
    </div>

    <p v-if="!empty && autoDepth && (exploring || detected)" class="depth-status" aria-live="polite">
      <template v-if="exploring">
        <NSpin :size="12" />
        {{ t('app.magic.exploring', { depth: exploring }) }}
      </template>
      <template v-else-if="detected">
        <icon-mdi-layers-outline class="depth-icon" aria-hidden="true" />
        <span v-if="detected.depth === 0">{{ t('app.magic.nothingToDecode') }}</span>
        <span v-else>{{ t('app.magic.detected', { depth: detected.depth }, detected.depth) }}</span>
        <span v-if="detected.limited" class="depth-limited">{{ t('app.magic.limited') }}</span>
      </template>
    </p>

    <p v-if="empty" class="hint">
      {{ t('app.magic.emptyInput') }}
    </p>


    <div v-else-if="busy && slow && !candidates.length" class="state">
      <NSpin size="small" />
      <span>{{ t('app.magic.running') }}</span>
    </div>

    <NAlert v-else-if="result?.error" type="error" :title="t('app.magic.failed')">
      {{ result.error }}
    </NAlert>

    <p v-else-if="result && !candidates.length" class="hint">
      {{ t('app.magic.noCandidate') }}
    </p>

    <ol v-else class="candidates" :aria-busy="busy">
      <li v-for="(candidate, index) in candidates" :key="index" class="candidate">
        <div class="candidate-head">
          <span class="candidate-recipe">{{ label(candidate) }}</span>
          <c-button v-if="candidate.recipe.length" size="small" type="primary" @click="emit('apply', candidate.recipe)">
            {{ applyLabel ?? t('app.magic.apply') }}
          </c-button>
        </div>
        <pre class="candidate-data">{{ candidate.data }}</pre>
        <div class="candidate-hints">
          <span v-for="hint in describe(candidate)" :key="hint" class="hint-badge">{{ hint }}</span>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.magic {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
}

.option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ct-text-muted);
}

.depth {
  width: 96px;
}

.depth-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0;
  font-size: 13px;
  color: var(--ct-text-muted);
}

.depth-icon {
  font-size: 16px;
  color: var(--ct-primary);
}

.depth-limited {
  flex-basis: 100%;
  font-size: 12px;
}

.crib {
  flex: 1 1 220px;
}

.state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ct-text-muted);
}

.hint {
  margin: 0;
  color: var(--ct-text-muted);
}

.candidates {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.candidate {
  padding: 12px 14px;
  border-radius: var(--ct-radius-large);
  border: 1px solid var(--ct-border);
  background: var(--ct-background);
}

.candidate-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.candidate-recipe {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.candidate-data {
  margin: 8px 0;
  padding: 8px 10px;
  max-height: 72px;
  overflow: hidden;
  border-radius: var(--ct-radius-small);
  background: var(--ct-surface);
  font-family: var(--ct-font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.candidate-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hint-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ct-neutral);
  color: var(--ct-text-muted);
  font-size: 12px;
}
</style>
