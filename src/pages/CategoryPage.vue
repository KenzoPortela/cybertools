<script setup lang="ts">
import { useHead } from '@vueuse/head';
import { useRouteQuery } from '@vueuse/router';
import { useRoute } from 'vue-router';
import { useShellCrumbs } from '~/app/shell';
import { catalog } from '~/catalog/catalog';
import { type CategoryId, categoryById } from '~/catalog/categories';
import { registry } from '~/catalog/registry';
import ToolRow from '~/components/ToolRow.vue';
import NotFoundPage from '~/pages/NotFoundPage.vue';

const route = useRoute();
const { t } = useI18n();

const category = computed(() => categoryById.get(String(route.params.id) as CategoryId));
const tools = computed(() => (category.value ? catalog.inCategory(category.value.id) : []));

useHead(computed(() => ({ title: category.value ? t(category.value.labelKey) : undefined })));
// Catégorie inconnue : c'est la page 404, rendue à la place, qui déclare son chemin.
useShellCrumbs(() => (category.value ? [{ label: t(category.value.labelKey).toLowerCase() }] : []));

/**
 * Filtre local : le moteur de recherche de l'accueil (fautes de frappe, deux
 * langues, synonymes), restreint à la catégorie. Sans filtre, l'ordre
 * alphabétique ; avec, l'ordre de pertinence. Dans l'URL, comme à l'accueil.
 */
const filter = useRouteQuery<string>('q', '', { mode: 'replace' });
const filtering = computed(() => (filter.value ?? '').trim().length > 0);
const shown = computed(() => {
  if (!filtering.value || !category.value) return tools.value;
  const id = category.value.id;
  return catalog.search(filter.value, registry.tools.length).filter(tool => tool.category === id);
});
</script>

<template>
  <NotFoundPage v-if="!category" />

  <section v-else class="page category">
    <header class="header">
      <span class="icon" aria-hidden="true">
        <component :is="category.icon" />
      </span>
      <div class="heading">
        <h1 class="title">
          {{ t(category.labelKey) }}
        </h1>
        <p class="count ct-mono">
          {{ t('app.category.count', tools.length) }}
        </p>
      </div>

      <label v-if="tools.length" class="filter">
        <icon-mdi-filter-variant class="filter-icon" aria-hidden="true" />
        <span class="sr-only">{{ t('app.category.filterLabel') }}</span>
        <input
          v-model="filter"
          type="search"
          class="filter-input"
          :placeholder="t('app.category.filter', tools.length)"
          autocomplete="off"
          spellcheck="false"
        >
      </label>
    </header>

    <ul v-if="shown.length" class="rows">
      <li v-for="tool in shown" :key="tool.id">
        <ToolRow :tool="tool" description :category="false" />
      </li>
    </ul>
    <p v-else class="empty">
      {{ filtering ? t('app.category.noMatch', { query: filter.trim() }) : t('app.category.empty') }}
    </p>
  </section>
</template>

<style scoped>
.category {
  font-size: var(--ct-font-size-ui);
}

/* En-tête compact : la liste est le contenu, pas le titre. */
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--ct-radius-control);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 18px;
}

.heading {
  min-width: 0;
}

.title {
  margin: 0;
  font-size: var(--ct-font-size-page-title);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.count {
  margin: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
}

.filter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 280px;
  height: 32px;
  margin-left: auto;
  padding: 0 8px;
  border: 1px solid var(--ct-input-border);
  border-radius: var(--ct-radius-control);
  background: var(--ct-input-background);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.filter:focus-within {
  border-color: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.filter-icon {
  flex-shrink: 0;
  color: var(--ct-text-faint);
}

.filter-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--ct-text);
  font: inherit;
  outline: none;
}

.filter-input::placeholder {
  color: var(--ct-text-faint);
}

.rows {
  margin: 0;
  padding: 4px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  background: var(--ct-surface);
  list-style: none;
}

.empty {
  margin: 0;
  padding: 16px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-secondary);
}

@media (hover: none) {
  /* Le champ lui-même, bordure déduite, fait 44 px. */
  .filter {
    height: 46px;
  }
}

/* Téléphone : le filtre passe sous le titre, sur toute la largeur. */
@media (max-width: 639.98px) {
  .header {
    flex-wrap: wrap;
  }

  .filter {
    flex: 1 1 100%;
    margin-left: 0;
  }
}
</style>
