import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { catalog } from '~/catalog/catalog';
import type { LocalizedTool } from '~/catalog/tool.types';

const MAX_RECENTS = 12;

/** Outils ouverts récemment, du plus récent au plus ancien. */
export const useRecentsStore = defineStore('recents', () => {
  const ids = useStorage<string[]>('cybertools:recents', []);

  const tools = computed<LocalizedTool[]>(() =>
    ids.value.map(id => catalog.byId.value.get(id)).filter((tool): tool is LocalizedTool => Boolean(tool)),
  );

  function record(id: string) {
    ids.value = [id, ...ids.value.filter(other => other !== id)].slice(0, MAX_RECENTS);
  }

  function clear() {
    ids.value = [];
  }

  return { ids, tools, record, clear };
});
