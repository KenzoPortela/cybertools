import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { externalOrigins, externalRequests } from '~/app/network-watch';
import { type BakeRecord, chefClient } from '~/integrations/cyberchef/chef-client';

/** Dernière exécution, datée pour qu'une page ne montre que les siennes. */
export interface LastBake extends BakeRecord {
  /** `performance.now()` à la fin du calcul. */
  at: number;
}

/**
 * La session en cours : ce que le moteur CyberChef a calculé depuis l'ouverture
 * de la page, et les requêtes parties vers un autre site.
 *
 * En mémoire seulement, jamais dans le stockage local : c'est une session, pas
 * un historique. Fermer l'onglet la remet à zéro.
 *
 * Les outils d'IT-Tools calculent dans leurs propres composants, sans point de
 * passage commun : ils ne sont pas comptés. Les chiffres portent sur le moteur
 * CyberChef — opérations seules, Recettes et Magic.
 */
export const useSessionStore = defineStore('session', () => {
  const operations = ref(0);
  const bytesProcessed = ref(0);
  const lastBake = shallowRef<LastBake>();

  chefClient.onBaked((record) => {
    operations.value += record.operations;
    bytesProcessed.value += record.inputBytes;
    lastBake.value = { ...record, at: performance.now() };
  });

  // Lus depuis la mesure du navigateur : des getters, que rien ne peut réécrire.
  const networkRequests = computed(() => externalRequests.value);
  const networkOrigins = computed(() => externalOrigins.value);

  return { operations, bytesProcessed, lastBake, networkRequests, networkOrigins };
});
