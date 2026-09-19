/**
 * Boucle de calcul commune à une opération, une recette et Magic.
 */
import { ref } from 'vue';
import type { RecipeStep } from '~/catalog/tool.types';
import { BakeSuperseded, type BakeResult, chefClient } from '~/integrations/cyberchef/chef-client';

/** Délai avant d'afficher l'indicateur de calcul : un indicateur qui clignote gêne plus qu'il n'aide. */
const SLOW_AFTER_MS = 600;

export function useBaker() {
  const result = ref<BakeResult>();
  const busy = ref(false);
  const slow = ref(false);

  /**
   * Numéro du calcul le plus récent. Un calcul lent (chargement d'un module
   * WebAssembly, par exemple) peut se terminer alors qu'un plus récent attend son
   * tour : seul le dernier a le droit de mettre à jour la sortie et l'indicateur,
   * sinon un résultat périmé s'afficherait comme définitif.
   */
  let latest = 0;
  let slowTimer: ReturnType<typeof setTimeout> | undefined;

  async function bake(input: string | ArrayBuffer, recipe: RecipeStep[]): Promise<BakeResult | undefined> {
    const ticket = ++latest;
    busy.value = true;
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { slow.value = true; }, SLOW_AFTER_MS);

    try {
      const outcome = await chefClient.bake(input, recipe);
      if (ticket !== latest) return undefined;
      result.value = outcome;
      return outcome;
    }
    catch (error) {
      if (error instanceof BakeSuperseded || ticket !== latest) return undefined;
      result.value = { type: 'error', duration: 0, error: error instanceof Error ? error.message : String(error) };
      return result.value;
    }
    finally {
      if (ticket === latest) {
        clearTimeout(slowTimer);
        busy.value = false;
        slow.value = false;
      }
    }
  }

  return { result, busy, slow, bake };
}
