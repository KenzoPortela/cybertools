import { useDebounceFn } from '@vueuse/core';
import { ref } from 'vue';

/**
 * Calcul d'une vue de panneau : dernier gagne (un réglage change vite via un
 * curseur), anti-rebond, et indicateur d'occupation. `run` renvoie la promesse
 * d'un `ImageData`, ou `undefined` s'il n'y a rien à calculer.
 */
export function useStegoResult(run: () => Promise<ImageData> | undefined) {
  const result = ref<ImageData>();
  const busy = ref(false);
  let token = 0;

  const recompute = useDebounceFn(async () => {
    const promise = run();
    if (!promise) return;
    const mine = ++token;
    busy.value = true;
    try {
      const data = await promise;
      if (mine === token) result.value = data;
    }
    catch {
      // Une requête dépassée est ignorée ; l'erreur reste sans conséquence.
    }
    finally {
      if (mine === token) busy.value = false;
    }
  }, 120);

  return { result, busy, recompute };
}
