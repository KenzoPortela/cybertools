<script setup lang="ts">
import { RouterLink } from 'vue-router';
import type { LocalizedTool } from '~/catalog/tool.types';
import FavoriteButton from '~/components/FavoriteButton.vue';

defineProps<{
  tool: LocalizedTool;
  /** Affiche la catégorie sous le titre : utile dans les résultats de recherche. */
  showCategory?: boolean;
}>();
</script>

<template>
  <RouterLink :to="`/tools/${tool.slug}`" class="card">
    <span class="icon" aria-hidden="true">
      <component :is="tool.icon" v-if="tool.icon" />
    </span>

    <span class="body">
      <span class="title">{{ tool.localizedTitle }}</span>
      <span v-if="showCategory" class="category ct-mono">{{ tool.localizedCategory }}</span>
      <span class="description">{{ tool.localizedDescription }}</span>
    </span>

    <span class="favorite">
      <FavoriteButton :tool-id="tool.id" size="small" />
    </span>
  </RouterLink>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 12px;
  align-items: start;
  padding: 14px 10px 14px 14px;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
  color: var(--ct-text);
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.card:hover {
  border-color: var(--ct-primary);
}

.card:focus-visible {
  outline: 2px solid var(--ct-primary);
  outline-offset: 2px;
}

.icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-border);
  color: var(--ct-primary);
  transition: background-color 0.15s ease;
}

.card:hover .icon {
  background: var(--ct-primary-faded);
}

.icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.title {
  font-weight: 600;
  line-height: 1.3;
}

.category {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ct-primary);
}

.description {
  font-size: 13px;
  line-height: 1.45;
  color: var(--ct-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* L'étoile reste discrète tant que l'outil n'est pas favori. */
.favorite {
  margin-top: -4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.card:hover .favorite,
.card:focus-within .favorite,
.favorite:has([aria-pressed='true']) {
  opacity: 1;
}

/* Pas de survol sur un écran tactile : l'étoile doit rester atteignable. */
@media (hover: none) {
  .favorite {
    opacity: 1;
  }
}
</style>
