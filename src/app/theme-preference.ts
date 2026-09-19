import { createSharedComposable, usePreferredDark, useStorage } from '@vueuse/core';
import { computed, watchEffect } from 'vue';
import { useStyleStore } from '@/stores/style.store';

export type ThemePreference = 'auto' | 'light' | 'dark';

const ORDER: ThemePreference[] = ['auto', 'light', 'dark'];

/**
 * Préférence de thème à trois états : automatique (suit le système), clair ou
 * sombre.
 *
 * Le store de style d'IT-Tools ne connaît que « sombre ou pas », et une bascule
 * y fige définitivement le choix : l'application cesse alors de suivre le
 * système. On garde donc notre propre préférence et on en déduit la valeur du
 * store — qui reste la source que lisent leurs composants.
 */
function themePreference() {
  const preference = useStorage<ThemePreference>('cybertools:theme', 'auto');
  const systemPrefersDark = usePreferredDark();
  const styleStore = useStyleStore();

  const isDark = computed(() =>
    preference.value === 'auto' ? systemPrefersDark.value : preference.value === 'dark',
  );

  watchEffect(() => {
    styleStore.isDarkTheme = isDark.value;
  });

  function cycle() {
    const next = ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length];
    preference.value = next;
  }

  return { preference, isDark, cycle };
}

/** Instance unique pour toute l'application : un seul état, un seul watcher. */
export const useThemePreference = createSharedComposable(themePreference);
