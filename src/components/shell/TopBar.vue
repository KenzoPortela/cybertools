<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { shellCrumbs } from '~/app/shell';
import AppLogo from '~/components/AppLogo.vue';
import PathCrumb from '~/components/PathCrumb.vue';

/**
 * Barre du haut : où l'on est (le fil d'Ariane que la page a déclaré), et à
 * droite les actions propres à la page, par le slot `actions`.
 *
 * Quand le rail passe en tiroir, elle porte aussi le bouton qui l'ouvre et la
 * marque, que le rail n'affiche plus.
 */
defineProps<{
  drawerOpen: boolean;
}>();

const emit = defineEmits<{
  openDrawer: [];
}>();

const { t } = useI18n();

const menuButton = ref<HTMLButtonElement>();

/** Le tiroir rend le focus au bouton qui l'a ouvert. */
defineExpose({ focusMenu: () => menuButton.value?.focus() });
</script>

<template>
  <header class="top-bar">
    <button
      ref="menuButton"
      type="button"
      class="top-bar-menu"
      :aria-label="t('app.shell.openMenu')"
      :aria-expanded="drawerOpen"
      aria-controls="ct-nav-rail"
      @click="emit('openDrawer')"
    >
      <icon-mdi-menu aria-hidden="true" />
    </button>

    <RouterLink to="/" class="top-bar-brand" :aria-label="t('app.nav.home')">
      <AppLogo :size="20" />
    </RouterLink>

    <PathCrumb :segments="shellCrumbs" class="top-bar-crumb" />

    <div class="top-bar-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--ct-topbar-height);
  padding: 0 24px;
  border-bottom: 1px solid var(--ct-border);
  background: color-mix(in srgb, var(--ct-background) 88%, transparent);
  backdrop-filter: saturate(160%) blur(10px);
}

.top-bar-crumb {
  flex: 1;
  min-width: 0;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.top-bar-actions:empty {
  display: none;
}

.top-bar-menu {
  display: none;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: -8px;
  padding: 0;
  border: 0;
  border-radius: var(--ct-radius-control);
  background: transparent;
  color: var(--ct-text-muted);
  font-size: 20px;
  cursor: pointer;
}

.top-bar-menu:hover {
  background: var(--ct-elevated);
  color: var(--ct-text);
}

.top-bar-brand {
  display: none;
  flex-shrink: 0;
}

/* Le rail devient un tiroir : la barre reprend la marque et son bouton. */
@media (max-width: 1023.98px) {
  .top-bar-menu {
    display: grid;
  }

  .top-bar-brand {
    display: flex;
  }
}

@media (max-width: 639.98px) {
  .top-bar {
    gap: 8px;
    padding: 0 16px;
  }
}

@media (hover: none) {
  .top-bar-menu {
    width: 44px;
    height: 44px;
    margin-left: -12px;
  }
}
</style>
