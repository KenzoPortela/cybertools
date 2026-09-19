<script setup lang="ts">
/**
 * Une opération CyberChef présentée comme un outil : paramètres, entrée, sortie.
 *
 * Le formulaire est entièrement dérivé de la configuration de l'opération ; le
 * calcul se fait dans le worker CyberChef, jamais sur un serveur.
 */
import { useDebounceFn } from '@vueuse/core';
import { NAlert, NSpin } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import CcArgsForm from '~/integrations/cyberchef/components/CcArgsForm.vue';
import CcInput, { type InputFile } from '~/integrations/cyberchef/components/CcInput.vue';
import CcOutput from '~/integrations/cyberchef/components/CcOutput.vue';
import { type OperationConfig, completeArgs, loadOperationConfig } from '~/integrations/cyberchef/operations';
import { sanitizeHtml } from '~/integrations/cyberchef/output';
import { useBaker } from '~/integrations/cyberchef/use-baker';
import { useRecipeStore } from '~/stores/recipe';
import { useSettingsStore } from '~/stores/settings';

const props = defineProps<{
  /** Nom de l'opération dans CyberChef, ex. « To Hex ». */
  op: string;
  /** Sert à nommer les fichiers téléchargés. */
  slug: string;
}>();

const { t } = useI18n();

const config = ref<OperationConfig>();
const loadError = ref<string>();
const args = ref<unknown[]>([]);
const input = ref('');
const file = ref<InputFile>();

const { result, busy, slow, bake: runBake } = useBaker();

async function load() {
  try {
    const operation = (await loadOperationConfig())[props.op];
    if (!operation) throw new Error(`opération inconnue : ${props.op}`);
    args.value = completeArgs(operation);
    config.value = operation;
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
  }
}

function bake() {
  if (!config.value) return;
  runBake(file.value?.buffer ?? input.value, [{ op: props.op, args: args.value }]);
}

const bakeSoon = useDebounceFn(bake, 250);

// Les opérations marquées manualBake ne se relancent pas à chaque frappe, ni
// aucune si l'utilisateur a désactivé le calcul en direct.
const { settings } = storeToRefs(useSettingsStore());
const autoBake = computed(() => Boolean(config.value && !config.value.manualBake && settings.value.autoBake));

watch([input, file, args], () => {
  if (autoBake.value) bakeSoon();
}, { deep: true });

onMounted(async () => {
  await load();
  // Premier calcul d'office : utile notamment aux générateurs, qui n'ont pas
  // besoin d'entrée.
  if (autoBake.value) bake();
});

const router = useRouter();
const recipes = useRecipeStore();

/** Continue dans l'atelier, avec les réglages et l'entrée en cours. */
function openInRecipes() {
  recipes.openWith([{ op: props.op, args: args.value }], file.value ? undefined : input.value);
  router.push('/tools/recipes');
}

const description = computed(() => (config.value ? sanitizeHtml(config.value.description) : ''));
</script>

<template>
  <div class="cc-op">
    <NAlert v-if="loadError" type="error" :title="t('app.cc.loadError')">
      {{ loadError }}
    </NAlert>

    <div v-else-if="!config" class="loading">
      <NSpin size="small" />
    </div>

    <template v-else>
      <div class="op-toolbar">
        <c-button size="small" @click="openInRecipes">
          <icon-mdi-chef-hat class="button-icon" aria-hidden="true" />
          {{ t('app.recipes.continueIn') }}
        </c-button>
      </div>

      <c-card v-if="config.args.length" :title="t('app.cc.parameters')" class="params">
        <CcArgsForm v-model:args="args" :config="config" />
      </c-card>

      <div class="io">
        <CcInput v-model:input="input" v-model:file="file" :manual="!autoBake" :running="busy" @run="bake" />
        <CcOutput
          :result="result"
          :busy="busy"
          :slow="slow"
          :input-empty="!file && input === ''"
          :filename="slug"
        />
      </div>

      <details class="about">
        <summary>{{ t('app.cc.aboutOperation') }}</summary>
        <!-- eslint-disable-next-line vue/no-v-html — assaini par DOMPurify -->
        <div class="about-body" v-html="description" />
        <a v-if="config.infoURL" :href="config.infoURL" target="_blank" rel="noopener noreferrer" class="about-link">
          {{ t('app.cc.learnMore') }}
        </a>
        <p class="about-credit">
          {{ t('app.cc.credit') }}
        </p>
      </details>
    </template>
  </div>
</template>

<style scoped>
.cc-op {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

.op-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: -4px;
}

.button-icon {
  margin-right: 6px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.io {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 860px) {
  .io {
    grid-template-columns: minmax(0, 1fr);
  }
}

.about {
  padding: 14px 16px;
  border-radius: var(--ct-radius-large);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
}

.about summary {
  cursor: pointer;
  font-weight: 500;
}

.about-body {
  margin-top: 12px;
  line-height: 1.6;
  color: var(--ct-text-muted);
  overflow-wrap: anywhere;
}

.about-body :deep(code) {
  font-family: var(--ct-font-mono);
  font-size: 12px;
  padding: 1px 4px;
  border-radius: var(--ct-radius-micro);
  background: var(--ct-neutral);
}

.about-link {
  display: inline-block;
  margin-top: 10px;
}

.about-credit {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}
</style>
