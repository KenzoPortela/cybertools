import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { catalog } from '~/catalog/catalog';
import type { LocalizedTool } from '~/catalog/tool.types';

/** Une ouverture d'outil : quand pour la dernière fois, et combien de fois en tout. */
export interface UsageEntry {
  id: string;
  /** Date de la dernière ouverture (ms depuis l'époque) ; 0 si elle est inconnue. */
  at: number;
  count: number;
}

export interface UsedTool {
  tool: LocalizedTool;
  at: number;
  count: number;
}

/**
 * Entrées gardées au plus. Assez pour que les « plus utilisés » survivent à
 * quelques jours d'outils ouverts une seule fois ; au-delà, la plus ancienne
 * ouverture est oubliée.
 */
const MAX_ENTRIES = 100;

/**
 * Lit le stockage, ancien format compris. Jusqu'ici on n'enregistrait que des
 * identifiants, du plus récent au plus ancien : on garde cet ordre, avec une
 * date inconnue (0) et une ouverture chacun — plutôt que d'inventer des dates.
 */
function readEntries(raw: string): UsageEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  }
  catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries: UsageEntry[] = [];
  for (const item of parsed) {
    if (typeof item === 'string') entries.push({ id: item, at: 0, count: 1 });
    else if (item && typeof item === 'object' && typeof item.id === 'string') {
      entries.push({
        id: item.id,
        at: Number.isFinite(item.at) ? item.at : 0,
        count: Number.isInteger(item.count) && item.count > 0 ? item.count : 1,
      });
    }
  }
  return entries;
}

/**
 * Outils ouverts dans ce navigateur : les récents (par date) et les plus
 * utilisés (par nombre d'ouvertures). Rien d'autre n'est retenu — ni ce qui a
 * été saisi, ni combien de temps.
 */
export const useRecentsStore = defineStore('recents', () => {
  const entries = useStorage<UsageEntry[]>('cybertools:recents', [], undefined, {
    serializer: { read: readEntries, write: value => JSON.stringify(value) },
  });

  function resolve(entry: UsageEntry): UsedTool | undefined {
    const tool = catalog.byId.value.get(entry.id);
    return tool && { tool, at: entry.at, count: entry.count };
  }

  /** Du plus récent au plus ancien. */
  const used = computed<UsedTool[]>(() =>
    entries.value.map(resolve).filter((item): item is UsedTool => Boolean(item)),
  );

  const tools = computed<LocalizedTool[]>(() => used.value.map(item => item.tool));
  const ids = computed(() => entries.value.map(entry => entry.id));

  /** Les plus ouverts d'abord ; à égalité, le plus récent. */
  const mostUsed = computed<UsedTool[]>(() =>
    [...used.value].sort((a, b) => b.count - a.count || b.at - a.at),
  );

  function record(id: string) {
    const previous = entries.value.find(entry => entry.id === id);
    const entry: UsageEntry = { id, at: Date.now(), count: (previous?.count ?? 0) + 1 };
    entries.value = [entry, ...entries.value.filter(other => other.id !== id)].slice(0, MAX_ENTRIES);
  }

  function clear() {
    entries.value = [];
  }

  return { entries, used, tools, ids, mostUsed, record, clear };
});
