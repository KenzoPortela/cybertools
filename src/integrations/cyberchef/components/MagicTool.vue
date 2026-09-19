<script setup lang="ts">
/**
 * Magic en outil autonome : on colle une donnée inconnue, CyberChef propose des
 * pistes de décodage, et chacune s'ouvre dans l'atelier de recettes.
 */
import { useRouter } from 'vue-router';
import type { RecipeStep } from '~/catalog/tool.types';
import CcInput, { type InputFile } from '~/integrations/cyberchef/components/CcInput.vue';
import MagicPanel from '~/integrations/cyberchef/components/MagicPanel.vue';
import { useRecipeStore } from '~/stores/recipe';

const { t } = useI18n();
const router = useRouter();
const recipes = useRecipeStore();

const input = ref('');
const file = ref<InputFile>();

function openInRecipes(recipe: RecipeStep[]) {
  recipes.openWith(recipe, file.value ? undefined : input.value);
  router.push('/tools/recipes');
}
</script>

<template>
  <div class="magic-tool">
    <CcInput v-model:input="input" v-model:file="file" />
    <c-card :title="t('app.magic.candidates')">
      <MagicPanel :input="file?.buffer ?? input" :apply-label="t('app.magic.openInRecipes')" @apply="openInRecipes" />
    </c-card>
  </div>
</template>

<style scoped>
.magic-tool {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

@media (max-width: 860px) {
  .magic-tool {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
