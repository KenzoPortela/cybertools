import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { catalog } from '~/catalog/catalog';
import type { LocalizedTool } from '~/catalog/tool.types';

/**
 * Outils favoris, dans l'ordre où l'utilisateur les a ajoutés.
 * On stocke des identifiants ; un outil disparu du catalogue (retiré en amont)
 * est simplement ignoré à la lecture.
 */
export const useFavoritesStore = defineStore('favorites', () => {
  const ids = useStorage<string[]>('cybertools:favorites', []);

  const tools = computed<LocalizedTool[]>(() =>
    ids.value.map(id => catalog.byId.value.get(id)).filter((tool): tool is LocalizedTool => Boolean(tool)),
  );

  function isFavorite(id: string) {
    return ids.value.includes(id);
  }

  function toggle(id: string) {
    ids.value = isFavorite(id) ? ids.value.filter(other => other !== id) : [...ids.value, id];
  }

  return { ids, tools, isFavorite, toggle };
});
