<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useCommandPalette } from '~/app/command-palette';

/**
 * Barre d'onglets du téléphone, à portée de pouce : accueil, recherche,
 * recettes, épinglés. Les catégories restent dans le tiroir.
 */
const emit = defineEmits<{
  openPinned: [];
}>();

const { t } = useI18n();
const { open: openPalette } = useCommandPalette();
</script>

<template>
  <nav class="tab-bar" :aria-label="t('app.shell.tabs.label')">
    <RouterLink to="/" class="tab" exact-active-class="tab--active">
      <icon-mdi-home-outline class="tab-icon" aria-hidden="true" />
      <span>{{ t('app.shell.tabs.home') }}</span>
    </RouterLink>
    <button type="button" class="tab" @click="openPalette">
      <icon-mdi-magnify class="tab-icon" aria-hidden="true" />
      <span>{{ t('app.shell.tabs.search') }}</span>
    </button>
    <RouterLink to="/tools/recipes" class="tab" active-class="tab--active">
      <icon-mdi-chef-hat class="tab-icon" aria-hidden="true" />
      <span>{{ t('app.shell.tabs.recipes') }}</span>
    </RouterLink>
    <button type="button" class="tab" @click="emit('openPinned')">
      <icon-mdi-star-outline class="tab-icon" aria-hidden="true" />
      <span>{{ t('app.shell.tabs.pinned') }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: none;
}

@media (max-width: 639.98px) {
  .tab-bar {
    position: fixed;
    inset: auto 0 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    height: calc(var(--ct-tabbar-height) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--ct-border);
    background: var(--ct-chassis);
  }
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ct-text-muted);
  font: inherit;
  font-size: 11px;
  text-decoration: none;
  cursor: pointer;
}

.tab-icon {
  font-size: 20px;
}

/*
 * L'accent sur l'icône seulement : en clair, les accents terminal et amber
 * n'atteignent pas 4,5:1 sur le châssis, trop peu pour un libellé de 11 px.
 */
.tab--active {
  color: var(--ct-text);
}

.tab--active .tab-icon {
  color: var(--ct-primary);
}
</style>
