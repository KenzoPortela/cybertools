import { type MaybeRefOrGetter, computed, onScopeDispose, ref, toValue, watchEffect } from 'vue';

/** Un segment du fil d'Ariane : un lien, sauf le dernier (la page courante). */
export interface Crumb {
  label: string;
  to?: string;
}

interface Declaration {
  owner: number;
  segments: Crumb[];
}

const declaration = ref<Declaration | null>(null);
let lastOwner = 0;

/** Chemin de la page affichée, lu par la TopBar. */
export const shellCrumbs = computed(() => declaration.value?.segments ?? []);

/**
 * Déclare le chemin de la page courante (`~/crypto/hash-text`), que la TopBar
 * affiche. Le fil d'Ariane vit dans le châssis, mais seule la page sait où elle
 * se trouve.
 *
 * Chaque déclaration retient son propriétaire : Vue démonte l'ancienne page
 * après le `setup` de la nouvelle, et ce démontage ne doit pas effacer le
 * chemin qui vient d'être posé.
 */
export function useShellCrumbs(segments: MaybeRefOrGetter<Crumb[]>) {
  const owner = ++lastOwner;
  watchEffect(() => {
    declaration.value = { owner, segments: toValue(segments) };
  });
  onScopeDispose(() => {
    if (declaration.value?.owner === owner) declaration.value = null;
  });
}
