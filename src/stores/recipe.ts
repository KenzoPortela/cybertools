import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { RecipeStep } from '~/catalog/tool.types';

export interface WorkbenchStep extends RecipeStep {
  /** Identifiant stable pour le rendu et le glisser-déposer. */
  uid: string;
  collapsed?: boolean;
}

let counter = 0;
export function newUid() {
  counter += 1;
  return `step-${Date.now().toString(36)}-${counter}`;
}

export function toWorkbenchStep(step: RecipeStep): WorkbenchStep {
  return { uid: newUid(), op: step.op, args: step.args ?? [], disabled: step.disabled };
}

/** La recette telle qu'on l'envoie au worker ou qu'on la partage : sans état d'interface. */
export function toRecipe(steps: WorkbenchStep[]): RecipeStep[] {
  return steps.map(({ op, args, disabled }) => (disabled ? { op, args, disabled: true } : { op, args }));
}

/**
 * État de l'atelier de recettes.
 *
 * L'atelier s'ouvre vide. La dernière recette non vide est conservée localement
 * pour pouvoir la reprendre d'un clic. L'entrée, elle, n'est jamais
 * enregistrée : elle peut contenir des données sensibles, et reste en mémoire
 * le temps de la session.
 */
export const useRecipeStore = defineStore('recipe', () => {
  const steps = ref<WorkbenchStep[]>([]);
  const input = ref('');

  const saved = useStorage<RecipeStep[]>('cybertools:recipe', []);
  // Une recette vidée n'efface pas la sauvegarde : « Reprendre » sert aussi
  // d'annulation après un « Vider » malencontreux.
  watch(steps, (current) => {
    if (current.length) saved.value = toRecipe(current);
  }, { deep: true });

  /**
   * Recette déposée par un autre outil (« Ouvrir dans les Recettes ») : l'atelier
   * la reprend à son ouverture. En mémoire plutôt que dans l'URL, pour que
   * l'entrée n'atterrisse pas dans l'historique du navigateur.
   */
  const handoff = ref<{ steps: RecipeStep[]; input?: string }>();

  function openWith(recipe: RecipeStep[], withInput?: string) {
    handoff.value = { steps: recipe, input: withInput };
  }

  function takeHandoff() {
    const pending = handoff.value;
    handoff.value = undefined;
    return pending;
  }

  return { steps, input, saved, openWith, takeHandoff };
});
