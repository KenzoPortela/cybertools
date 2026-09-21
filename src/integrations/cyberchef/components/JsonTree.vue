<script setup lang="ts">
/**
 * Arbre d'une valeur JSON, dépliable nœud par nœud. Les deux premiers niveaux
 * sont ouverts ; au-delà de 200 enfants, le reste est résumé plutôt que dessiné.
 */
const props = withDefaults(defineProps<{
  value: unknown;
  /** Clé ou index du nœud chez son parent. */
  name?: string;
  depth?: number;
}>(), {
  name: undefined,
  depth: 0,
});

const { t } = useI18n();

const MAX_CHILDREN = 200;

const isContainer = computed(() => props.value !== null && typeof props.value === 'object');
const entries = computed(() => (isContainer.value ? Object.entries(props.value as object) : []));
const shown = computed(() => entries.value.slice(0, MAX_CHILDREN));
const summary = computed(() => (Array.isArray(props.value) ? `[${entries.value.length}]` : `{${entries.value.length}}`));

const kind = computed(() => {
  const value = props.value;
  if (value === null) return 'null';
  return typeof value;
});

const display = computed(() => (kind.value === 'string' ? JSON.stringify(props.value) : String(props.value)));
</script>

<template>
  <details v-if="isContainer" class="node" :open="depth < 2">
    <summary class="node-head">
      <span v-if="name !== undefined" class="node-key">{{ name }}</span>
      <span class="node-summary">{{ summary }}</span>
    </summary>
    <div class="node-children">
      <JsonTree v-for="[key, child] in shown" :key="key" :value="child" :name="key" :depth="depth + 1" />
      <p v-if="entries.length > shown.length" class="node-more">
        {{ t('app.cc.treeMore', { count: entries.length - shown.length }) }}
      </p>
    </div>
  </details>
  <div v-else class="leaf">
    <span v-if="name !== undefined" class="node-key">{{ name }}</span>
    <span class="leaf-value" :class="`leaf-value--${kind}`">{{ display }}</span>
  </div>
</template>

<style scoped>
.node,
.leaf {
  font-family: var(--ct-font-mono);
  font-size: var(--ct-font-size-data);
  line-height: 20px;
}

.node-head {
  cursor: pointer;
}

.node-children {
  padding-left: 16px;
  border-left: 1px solid var(--ct-border);
  margin-left: 4px;
}

.leaf {
  display: flex;
  gap: 8px;
  padding-left: 12px;
  min-width: 0;
}

.node-key {
  margin-right: 8px;
  color: var(--ct-text-muted);
}

.node-key::after {
  content: ':';
}

.node-summary {
  color: var(--ct-text-faint);
}

.leaf-value {
  overflow-wrap: anywhere;
}

.leaf-value--string {
  color: var(--ct-primary);
}

.leaf-value--number,
.leaf-value--boolean {
  color: var(--ct-warning);
}

.leaf-value--null {
  color: var(--ct-text-faint);
}

.node-more {
  margin: 0;
  padding-left: 12px;
  color: var(--ct-text-faint);
}
</style>
