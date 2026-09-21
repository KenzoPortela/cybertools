/**
 * Vue localisée du registre, et recherche.
 *
 * Tout est recalculé quand la langue change. On passe par l'instance globale
 * d'i18n plutôt que par `useI18n()`, pour que le catalogue soit utilisable hors
 * d'un composant (routeur, palette de commandes).
 */
import { computed, effectScope } from 'vue';
import { i18n } from '~/app/i18n';
import { type CategoryId, categoryById } from '~/catalog/categories';
import { registry } from '~/catalog/registry';
import { createSearchIndex } from '~/catalog/search';
import type { LocalizedText, LocalizedTool } from '~/catalog/tool.types';

export { normalizeForSearch } from '~/catalog/search';

function createCatalog() {
  const { t, te, locale } = i18n.global;

  function resolveText(text: LocalizedText) {
    for (const key of text.keys) {
      // La langue courante, ou l'anglais qui sert de repli : IT-Tools ne
      // fournit ses titres qu'en anglais.
      if (te(key, locale.value) || te(key, 'en')) return t(key);
    }
    return text.fallback;
  }

  const tools = computed<LocalizedTool[]>(() => {
    const collator = new Intl.Collator(locale.value, { sensitivity: 'base' });
    return registry.tools
      .map(tool => ({
        ...tool,
        localizedTitle: resolveText(tool.title),
        localizedDescription: resolveText(tool.description),
        localizedCategory: t(categoryById.get(tool.category)?.labelKey ?? tool.category),
      }))
      .sort((a, b) => collator.compare(a.localizedTitle, b.localizedTitle));
  });

  const byId = computed(() => new Map(tools.value.map(tool => [tool.id, tool])));
  const bySlug = computed(() => new Map(tools.value.map(tool => [tool.slug, tool])));

  /**
   * L'outil d'un slug. Un ancien slug (celui d'IT-Tools, ou « recettes » avant
   * le passage des adresses en anglais) passe par la table des alias : un lien
   * déjà partagé continue d'ouvrir le bon outil.
   */
  function toolForSlug(slug: string): LocalizedTool | undefined {
    return bySlug.value.get(slug) ?? bySlug.value.get(registry.aliases.get(`/${slug}`) ?? '');
  }

  function inCategory(id: CategoryId) {
    return tools.value.filter(tool => tool.category === id);
  }

  // Titre traduit et titre amont à égalité : qui tape un terme technique
  // anglais (« hash », « slugify ») doit tomber sur l'outil qui le porte dans son
  // nom d'origine, même quand son titre français dit autre chose.
  const index = computed(() => createSearchIndex(tools.value, tool => [
    { text: tool.localizedTitle, weight: 3, title: true },
    { text: tool.title.fallback, weight: 3, title: true },
    { text: tool.keywords, weight: 2.5 },
    { text: tool.localizedDescription, weight: 1 },
    { text: tool.localizedCategory, weight: 0.5 },
  ]));

  function search(query: string, limit = 50): LocalizedTool[] {
    return index.value.search(query, limit);
  }

  return { tools, byId, bySlug, toolForSlug, inCategory, search, resolveText };
}

// Instance unique, détachée de tout composant.
export const catalog = effectScope(true).run(createCatalog)!;
