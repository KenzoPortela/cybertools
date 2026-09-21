<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { categoryById } from '~/catalog/categories';
import type { LocalizedTool } from '~/catalog/tool.types';
import FavoriteButton from '~/components/FavoriteButton.vue';

/**
 * Un outil sur une ligne dense : icône, nom, catégorie, et une mesure à droite
 * (depuis quand, combien de fois). Cinq lignes tiennent dans la hauteur de deux
 * anciennes cartes.
 *
 * La description ne s'affiche que là où elle aide à choisir — les résultats de
 * recherche —, sur la même ligne, tronquée, comme dans la palette.
 *
 * Toute la ligne mène à l'outil, mais le lien et l'étoile restent frères : un
 * bouton dans un lien serait invalide, et le lien s'étend sous la ligne entière
 * par un pseudo-élément.
 */
defineProps<{
  tool: LocalizedTool;
  /** Afficher la description, en gris, après le nom. */
  description?: boolean;
  /** Mesure à droite, en mono : `2 min`, `12`. */
  meta?: string;
  /** Texte complet de la mesure, en infobulle (`ouvert 12 fois`, date exacte). */
  metaTitle?: string;
}>();

function iconOf(tool: LocalizedTool) {
  return tool.icon ?? categoryById.get(tool.category)?.icon;
}
</script>

<template>
  <div class="tool-row">
    <span class="tool-row-icon" aria-hidden="true">
      <component :is="iconOf(tool)" />
    </span>
    <RouterLink :to="`/tools/${tool.slug}`" class="tool-row-link">
      <span class="tool-row-name">{{ tool.localizedTitle }}</span>
    </RouterLink>
    <span v-if="description" class="tool-row-description">{{ tool.localizedDescription }}</span>
    <span class="tool-row-info">
      <span class="tool-row-category ct-mono">{{ tool.localizedCategory.toLowerCase() }}</span>
      <span v-if="meta" class="tool-row-meta ct-mono" :title="metaTitle">{{ meta }}</span>
    </span>
    <span class="tool-row-actions">
      <FavoriteButton :tool-id="tool.id" size="small" />
    </span>
  </div>
</template>

<style scoped>
.tool-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 34px;
  padding: 0 4px 0 8px;
  border-radius: var(--ct-radius-control);
  font-size: var(--ct-font-size-ui);
  transition: background-color 0.15s ease;
}

.tool-row:hover,
.tool-row:focus-within {
  background: var(--ct-elevated);
}

.tool-row-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: var(--ct-radius-micro);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 14px;
}

.tool-row-link {
  flex-shrink: 0;
  min-width: 0;
  max-width: 45%;
  color: var(--ct-text);
  text-decoration: none;
}

/* Toute la ligne est cliquable ; l'étoile passe au-dessus. */
.tool-row-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.tool-row-link:focus-visible {
  outline: none;
}

.tool-row:has(.tool-row-link:focus-visible) {
  outline: 2px solid var(--ct-primary);
  outline-offset: -2px;
}

.tool-row-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-row-description {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-row-info {
  display: contents;
}

.tool-row-category {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--ct-text-faint);
  font-size: 11px;
}

.tool-row-meta {
  flex-shrink: 0;
  min-width: 40px;
  color: var(--ct-text-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.tool-row-description + .tool-row-info .tool-row-category {
  margin-left: 0;
}

/* L'étoile n'apparaît qu'au survol, sauf si l'outil est déjà épinglé. */
.tool-row-actions {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tool-row:hover .tool-row-actions,
.tool-row:focus-within .tool-row-actions,
.tool-row-actions:has(.favorite--active) {
  opacity: 1;
}

/* Au doigt : pas de survol, donc l'étoile toujours visible, et 44 px de haut. */
@media (hover: none) {
  .tool-row {
    min-height: 44px;
  }

  .tool-row-actions {
    opacity: 1;
  }

  .tool-row-actions :deep(.favorite) {
    width: 44px;
    height: 44px;
  }
}

/*
 * Téléphone : deux lignes, le nom en entier, puis catégorie et mesure dessous.
 * La description, elle, ne tient plus.
 */
@media (max-width: 639.98px) {
  .tool-row {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto;
    grid-template-areas:
      'icon name actions'
      'icon info actions';
    column-gap: 12px;
    row-gap: 2px;
    padding-block: 8px;
  }

  .tool-row-icon {
    grid-area: icon;
  }

  .tool-row-link {
    grid-area: name;
    max-width: none;
  }

  .tool-row-description {
    display: none;
  }

  .tool-row-info {
    grid-area: info;
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .tool-row-category {
    margin-left: 0;
  }

  .tool-row-meta {
    min-width: 0;
    text-align: left;
  }

  .tool-row-meta::before {
    content: '· ';
  }

  .tool-row-actions {
    grid-area: actions;
  }
}
</style>
