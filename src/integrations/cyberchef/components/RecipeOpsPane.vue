<script setup lang="ts">
/**
 * Panneau des opérations de l'atelier : toujours ouvert, filtré au clavier par
 * le moteur de recherche du site (fautes de frappe, synonymes, deux langues),
 * groupé par catégorie.
 *
 * Clavier complet, sans quitter le champ : ↑ ↓ parcourent la liste, Entrée
 * ajoute l'opération en fin de recette, Maj+Entrée remplace la recette par
 * elle, Échap vide le filtre. À la souris : clic pour ajouter, Maj+clic pour
 * remplacer.
 */
import { CATEGORY_IDS, type CategoryId, categoryById } from '~/catalog/categories';
import { operationCategory } from '~/catalog/sources/cyberchef';
import { type RecipeOperation, recipeOperations, searchOperations } from '~/integrations/cyberchef/recipe-operations';

const emit = defineEmits<{
  add: [name: string];
  replace: [name: string];
}>();

const { t } = useI18n();

const query = ref('');
const active = ref(0);
const list = ref<HTMLElement>();
const field = ref<HTMLInputElement>();

/** Opérations sans outil au catalogue (Fork, Merge…) : leur propre groupe. */
type GroupId = CategoryId | 'flow' | 'suggested' | 'best';

interface Group {
  id: GroupId;
  label: string;
  items: RecipeOperation[];
}

/** Meilleurs résultats, en tête, avant le rangement par catégorie. */
const BEST = 4;

function groupOf(operation: RecipeOperation): CategoryId | 'flow' {
  return operation.flowControl ? 'flow' : operationCategory(operation);
}

function labelOf(id: CategoryId | 'flow') {
  return id === 'flow' ? t('app.recipes.flowControl') : t(categoryById.get(id)!.labelKey);
}

/**
 * Range par catégorie. Sans filtre, dans l'ordre des catégories du site et par
 * nom ; avec un filtre, dans l'ordre de pertinence (une catégorie apparaît là
 * où tombe son meilleur résultat).
 */
function byCategory(operations: RecipeOperation[], sorted: boolean): Group[] {
  const groups = new Map<CategoryId | 'flow', RecipeOperation[]>();
  for (const operation of operations) {
    const id = groupOf(operation);
    groups.set(id, [...(groups.get(id) ?? []), operation]);
  }
  const ids = sorted ? [...CATEGORY_IDS, 'flow' as const].filter(id => groups.has(id)) : [...groups.keys()];
  return ids.map(id => ({
    id,
    label: labelOf(id),
    items: sorted ? groups.get(id)!.sort((a, b) => a.name.localeCompare(b.name)) : groups.get(id)!,
  }));
}

const filtering = computed(() => query.value.trim().length > 0);
const results = computed(() => (filtering.value ? searchOperations(query.value, 60) : recipeOperations));

const groups = computed<Group[]>(() => {
  if (!filtering.value) {
    return [
      { id: 'suggested', label: t('app.recipes.suggested'), items: searchOperations('') },
      ...byCategory([...recipeOperations], true),
    ];
  }
  const found = results.value;
  return [
    { id: 'best' as const, label: t('app.recipes.bestMatches'), items: found.slice(0, BEST) },
    ...byCategory(found.slice(BEST), false),
  ].filter(group => group.items.length);
});

/** La liste à plat, dans l'ordre affiché : c'est elle que parcourent les flèches. */
const flat = computed(() => groups.value.flatMap(group => group.items.map(item => ({ group: group.id, item }))));

function optionId(group: GroupId, name: string) {
  return `ops-${group}-${name.replace(/\W+/g, '-')}`;
}

const activeId = computed(() => {
  const entry = flat.value[active.value];
  return entry ? optionId(entry.group, entry.item.name) : undefined;
});

watch(query, () => {
  active.value = 0;
  list.value?.scrollTo({ top: 0 });
});

watch(active, async () => {
  await nextTick();
  if (activeId.value) document.getElementById(activeId.value)?.scrollIntoView({ block: 'nearest' });
});

function choose(name: string | undefined, replaceRecipe: boolean) {
  if (!name) return;
  if (replaceRecipe) emit('replace', name);
  else emit('add', name);
  field.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  const count = flat.value.length;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (count) active.value = (active.value + 1) % count;
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (count) active.value = (active.value - 1 + count) % count;
  }
  else if (event.key === 'Enter') {
    event.preventDefault();
    choose(flat.value[active.value]?.item.name, event.shiftKey);
  }
  else if (event.key === 'Escape' && query.value) {
    event.preventDefault();
    query.value = '';
  }
}
</script>

<template>
  <div class="ops">
    <div class="ops-field">
      <icon-mdi-magnify class="ops-field-icon" aria-hidden="true" />
      <input
        ref="field"
        v-model="query"
        class="ops-search"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls="ops-list"
        :aria-activedescendant="activeId"
        :aria-label="t('app.recipes.filterOperations')"
        :placeholder="t('app.recipes.filterOperations')"
        autocomplete="off"
        spellcheck="false"
        @keydown="onKeydown"
      >
      <span class="ops-count ct-mono" :title="t('app.recipes.operationCount', results.length)">{{ results.length }}</span>
    </div>

    <div id="ops-list" ref="list" class="ops-list" role="listbox" :aria-label="t('app.recipes.operations')">
      <div v-for="group in groups" :key="group.id" class="ops-group" role="group" :aria-labelledby="`ops-group-${group.id}`">
        <div :id="`ops-group-${group.id}`" class="ops-group-label ct-mono">
          <span>{{ group.label }}</span>
          <span>{{ group.items.length }}</span>
        </div>
        <div
          v-for="operation in group.items"
          :id="optionId(group.id, operation.name)"
          :key="operation.name"
          class="ops-item"
          :class="{ 'ops-item--active': optionId(group.id, operation.name) === activeId }"
          role="option"
          :aria-selected="optionId(group.id, operation.name) === activeId"
          :title="operation.summary"
          @mousedown.prevent
          @click="(event: MouseEvent) => choose(operation.name, event.shiftKey)"
        >
          <span class="ops-item-name">{{ operation.name }}</span>
        </div>
      </div>
      <p v-if="!flat.length" class="ops-empty">
        {{ t('app.recipes.noOperation') }}
      </p>
    </div>

    <p class="ops-hints">
      <span><kbd>↵</kbd> {{ t('app.recipes.hintAdd') }}</span>
      <span><kbd>⇧↵</kbd> {{ t('app.recipes.hintReplace') }}</span>
    </p>
  </div>
</template>

<style scoped>
.ops {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ops-field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: 32px;
  margin: 12px 12px 8px;
  padding: 0 8px;
  border: 1px solid var(--ct-input-border);
  border-radius: var(--ct-radius-control);
  background: var(--ct-input-background);
}

.ops-field:focus-within {
  border-color: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.ops-field-icon {
  flex-shrink: 0;
  color: var(--ct-text-faint);
}

.ops-search {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--ct-text);
  font: inherit;
  outline: none;
}

.ops-search::placeholder {
  color: var(--ct-text-faint);
}

.ops-count {
  flex-shrink: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.ops-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 8px 8px;
}

.ops-group + .ops-group {
  margin-top: 12px;
}

.ops-group-label {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ops-item {
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  border-radius: var(--ct-radius-control);
  color: var(--ct-text-muted);
  cursor: pointer;
}

.ops-item:hover {
  background: var(--ct-elevated);
  color: var(--ct-text);
}

/* L'opération qu'Entrée ajouterait : ce qui est vivant prend l'accent. */
.ops-item--active {
  background: var(--ct-primary-faded);
  color: var(--ct-text);
  box-shadow: inset 2px 0 0 var(--ct-primary);
}

.ops-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops-empty {
  margin: 0;
  padding: 16px 8px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-secondary);
}

.ops-hints {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  margin: 0;
  padding: 0 12px;
  height: var(--ct-statusbar-height);
  align-items: center;
  border-top: 1px solid var(--ct-border);
  color: var(--ct-text-faint);
  font-size: 11px;
}

@media (hover: none) {
  .ops-item {
    min-height: 44px;
  }

  /* Le champ lui-même, bordure déduite, fait 44 px. */
  .ops-field {
    height: 46px;
  }

  /* Pas de clavier physique : les raccourcis n'ont rien à apprendre. */
  .ops-hints {
    display: none;
  }
}
</style>
