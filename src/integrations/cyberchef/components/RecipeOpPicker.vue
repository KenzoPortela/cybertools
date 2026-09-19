<script setup lang="ts">
/**
 * Recherche d'une opération à ajouter à la recette. Clavier complet : ↑ ↓ pour
 * parcourir, Entrée pour ajouter, Échap pour fermer.
 */
import { onClickOutside } from '@vueuse/core';
import { searchOperations } from '~/integrations/cyberchef/recipe-operations';

const emit = defineEmits<{ add: [name: string] }>();

const { t } = useI18n();

const query = ref('');
const open = ref(false);
const active = ref(0);
const root = ref<HTMLElement>();
const input = ref<HTMLInputElement>();

const results = computed(() => searchOperations(query.value));

watch(query, () => {
  active.value = 0;
  open.value = true;
});

onClickOutside(root, () => {
  open.value = false;
});

function add(name: string | undefined) {
  if (!name) return;
  emit('add', name);
  query.value = '';
  open.value = false;
  input.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  const count = results.value.length;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    open.value = true;
    if (count) active.value = (active.value + 1) % count;
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (count) active.value = (active.value - 1 + count) % count;
  }
  else if (event.key === 'Enter') {
    event.preventDefault();
    add(results.value[active.value]?.name);
  }
  else if (event.key === 'Escape') {
    open.value = false;
  }
}

watch(active, async (index) => {
  await nextTick();
  root.value?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
});
</script>

<template>
  <div ref="root" class="picker">
    <div class="field">
      <icon-mdi-plus class="field-icon" aria-hidden="true" />
      <input
        ref="input"
        v-model="query"
        class="field-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="recipe-op-list"
        :aria-expanded="open"
        :aria-activedescendant="open && results.length ? `recipe-op-${active}` : undefined"
        :placeholder="t('app.recipes.addPlaceholder')"
        autocomplete="off"
        spellcheck="false"
        @focus="open = true"
        @keydown="onKeydown"
      >
    </div>

    <ul v-show="open" id="recipe-op-list" class="list" role="listbox">
      <li v-if="!query.trim()" class="list-title" role="presentation">
        {{ t('app.recipes.suggested') }}
      </li>
      <li
        v-for="(operation, index) in results"
        :id="`recipe-op-${index}`"
        :key="operation.name"
        :data-index="index"
        class="item"
        :class="{ 'item--active': index === active }"
        role="option"
        :aria-selected="index === active"
        @mousemove="active = index"
        @mousedown.prevent="add(operation.name)"
      >
        <span class="item-head">
          <span class="item-name">{{ operation.name }}</span>
          <span class="item-category">{{ operation.category }}</span>
        </span>
        <span class="item-summary">{{ operation.summary }}</span>
      </li>
      <li v-if="!results.length" class="empty" role="presentation">
        {{ t('app.recipes.noOperation') }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}

.field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  /* Barre de recherche : seule forme en pilule du site. */
  border-radius: var(--ct-radius-pill);
  border: 1px solid var(--ct-input-border);
  background: var(--ct-input-background);
}

.field:focus-within {
  border-color: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.field-icon {
  font-size: 18px;
  color: var(--ct-primary);
}

.field-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ct-text);
  font: inherit;
}

.field-input::placeholder {
  color: var(--ct-text-muted);
}

.list {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 360px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: var(--ct-radius-large);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
  box-shadow: var(--ct-shadow);
}

.list-title {
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ct-text-muted);
}

.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: var(--ct-radius-medium);
  cursor: pointer;
}

.item--active {
  background: var(--ct-primary-faded);
}

.item-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.item-name {
  font-weight: 500;
}

.item-category {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ct-text-muted);
}

.item-summary {
  font-size: 12px;
  color: var(--ct-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  padding: 16px 10px;
  text-align: center;
  color: var(--ct-text-muted);
}
</style>
