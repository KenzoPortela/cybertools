import { type MaybeRefOrGetter, type Ref, computed, onScopeDispose, shallowRef, toValue, watchEffect } from 'vue';

/**
 * Ce que la page affichée confie au châssis. Le châssis l'affiche, mais seule
 * la page sait ce qu'elle a à dire : où elle se trouve, ce qu'elle a calculé.
 *
 * Chaque déclaration retient son propriétaire : Vue démonte l'ancienne page
 * après le `setup` de la nouvelle, et ce démontage ne doit pas effacer ce que la
 * nouvelle vient de poser.
 */
function pageDeclaration<T>(fallback: T) {
  const declaration = shallowRef<{ owner: number; value: T } | null>(null);
  let lastOwner = 0;

  const current = computed(() => declaration.value?.value ?? fallback) as Readonly<Ref<T>>;

  function declare(source: MaybeRefOrGetter<T>) {
    const owner = ++lastOwner;
    watchEffect(() => {
      declaration.value = { owner, value: toValue(source) };
    });
    onScopeDispose(() => {
      if (declaration.value?.owner === owner) declaration.value = null;
    });
  }

  return { current, declare };
}

// --- Fil d'Ariane --------------------------------------------------------------

/** Un segment du fil d'Ariane : un lien, sauf le dernier (la page courante). */
export interface Crumb {
  label: string;
  to?: string;
}

const crumbs = pageDeclaration<Crumb[]>([]);

/** Chemin de la page affichée, lu par la TopBar. */
export const shellCrumbs = crumbs.current;

/** Déclare le chemin de la page courante (`~/crypto/hash-text`), affiché dans la TopBar. */
export const useShellCrumbs = crumbs.declare;

// --- Barre d'état ----------------------------------------------------------------

/** Une mesure de la barre d'état ; la pastille dit si elle est bonne ou non. */
export interface StatusItem {
  text: string;
  tone?: 'success' | 'warning' | 'error';
}

const status = pageDeclaration<StatusItem[] | null>(null);

/** Mesures propres à la page affichée ; `null` : la barre montre la session. */
export const shellStatus = status.current;

/**
 * Déclare ce que la page sait d'elle-même, à gauche de la barre d'état
 * (`source : IT-Tools`, `44 o → 152 o · 1,2 ms`). `null`, ou rien de déclaré :
 * la barre montre les chiffres de la session.
 */
export const useShellStatus = status.declare;
