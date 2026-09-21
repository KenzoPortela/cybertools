<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { paletteShortcutLabel, useCommandPalette } from '~/app/command-palette';
import { SUPPORTED_LOCALES } from '~/app/i18n';
import { useThemePreference } from '~/app/theme-preference';
import { catalog } from '~/catalog/catalog';
import { categories, categoryById } from '~/catalog/categories';
import type { LocalizedTool } from '~/catalog/tool.types';
import AppLogo from '~/components/AppLogo.vue';
import { useFavoritesStore } from '~/stores/favorites';

/**
 * Rail de navigation permanent : on sait toujours où l'on est parmi les outils,
 * et on change d'outil sans repasser par l'accueil.
 *
 * Replié, il se réduit à une colonne d'icônes. Les libellés restent alors dans
 * le document, masqués à l'œil seulement : un lecteur d'écran les lit toujours.
 */
const props = defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggleCollapse: [];
}>();

const { t, locale } = useI18n();
const route = useRoute();
const favorites = useFavoritesStore();
const { open: openPalette } = useCommandPalette();
const { preference, cycle: cycleTheme } = useThemePreference();

const version = __APP_VERSION__;

/** L'atelier : les trois espaces de travail, dans l'ordre de l'accueil. */
const WORKBENCH_IDS = ['recipes', 'magic', 'stego-lab'];
const workbench = computed(() => WORKBENCH_IDS
  .map(id => catalog.byId.value.get(id))
  .filter((tool): tool is LocalizedTool => Boolean(tool)));

const counts = computed(() => new Map(categories.map(category => [category.id, catalog.inCategory(category.id).length])));

const currentTool = computed(() => (route.name === 'tool' ? catalog.toolForSlug(String(route.params.slug)) : undefined));

/**
 * Catégorie à signaler : celle de la page, ou celle de l'outil ouvert — sauf si
 * l'outil a déjà sa propre entrée dans l'atelier, pour ne pas allumer deux
 * lignes pour une seule page.
 */
const activeCategory = computed(() => {
  if (route.name === 'category') return String(route.params.id);
  const tool = currentTool.value;
  return tool && !WORKBENCH_IDS.includes(tool.id) ? tool.category : undefined;
});

function iconOf(tool: LocalizedTool) {
  return tool.icon ?? categoryById.get(tool.category)?.icon;
}

const themeLabel = computed(() => t(`app.theme.${preference.value}`));

function switchLocale() {
  locale.value = SUPPORTED_LOCALES.find(code => code !== locale.value) ?? 'fr';
}

/** Libellé en infobulle, seulement quand le rail replié l'a masqué. */
function hint(label: string) {
  return props.collapsed ? label : undefined;
}
</script>

<template>
  <aside class="rail" :class="{ 'rail--collapsed': collapsed }">
    <div class="rail-brand">
      <RouterLink to="/" class="brand" :aria-label="t('app.nav.home')" :title="hint(t('app.nav.home'))">
        <AppLogo :size="20" />
        <span class="brand-name ct-mono">cybertools</span>
      </RouterLink>
      <span class="brand-version ct-mono">{{ version }}</span>
    </div>

    <button
      type="button"
      class="rail-search"
      :aria-label="t('app.palette.open')"
      :title="hint(t('app.palette.trigger'))"
      @click="openPalette"
    >
      <icon-mdi-magnify class="rail-icon" aria-hidden="true" />
      <span class="rail-search-label">{{ t('app.palette.trigger') }}</span>
      <kbd class="rail-search-kbd">{{ paletteShortcutLabel }}</kbd>
    </button>

    <nav class="rail-nav" :aria-label="t('app.shell.navLabel')">
      <section class="rail-section" aria-labelledby="rail-workbench">
        <h2 id="rail-workbench" class="rail-label ct-mono">
          {{ t('app.shell.workbench') }}
        </h2>
        <ul class="rail-list">
          <li v-for="tool in workbench" :key="tool.id">
            <RouterLink
              :to="`/tools/${tool.slug}`"
              class="rail-item"
              :class="{ 'rail-item--active': currentTool?.id === tool.id }"
              :title="hint(tool.localizedTitle)"
            >
              <component :is="iconOf(tool)" class="rail-icon" aria-hidden="true" />
              <span class="rail-item-label">{{ tool.localizedTitle }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section
        v-if="favorites.tools.length || !collapsed"
        id="ct-rail-pinned"
        class="rail-section"
        aria-labelledby="rail-pinned"
      >
        <h2 id="rail-pinned" class="rail-label ct-mono" tabindex="-1">
          {{ t('app.shell.pinned') }}
        </h2>
        <ul v-if="favorites.tools.length" class="rail-list">
          <li v-for="tool in favorites.tools" :key="tool.id">
            <RouterLink
              :to="`/tools/${tool.slug}`"
              class="rail-item"
              :class="{ 'rail-item--active': currentTool?.id === tool.id }"
              :title="hint(tool.localizedTitle)"
            >
              <component :is="iconOf(tool)" class="rail-icon" aria-hidden="true" />
              <span class="rail-item-label">{{ tool.localizedTitle }}</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="rail-empty">
          {{ t('app.shell.pinnedEmpty') }}
        </p>
      </section>

      <section class="rail-section" aria-labelledby="rail-categories">
        <h2 id="rail-categories" class="rail-label ct-mono">
          {{ t('app.home.categories') }}
          <span class="rail-count">{{ categories.length }}</span>
        </h2>
        <ul class="rail-list">
          <li v-for="category in categories" :key="category.id">
            <RouterLink
              :to="`/categories/${category.id}`"
              class="rail-item"
              :class="{ 'rail-item--active': activeCategory === category.id }"
              :title="hint(t(category.labelKey))"
            >
              <component :is="category.icon" class="rail-icon" aria-hidden="true" />
              <span class="rail-item-label">{{ t(category.labelKey) }}</span>
              <span class="rail-count ct-mono">{{ counts.get(category.id) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </nav>

    <div class="rail-footer">
      <button type="button" class="rail-tool" :aria-label="themeLabel" :title="themeLabel" @click="cycleTheme">
        <icon-mdi-theme-light-dark v-if="preference === 'auto'" aria-hidden="true" />
        <icon-mdi-white-balance-sunny v-else-if="preference === 'light'" aria-hidden="true" />
        <icon-mdi-weather-night v-else aria-hidden="true" />
      </button>
      <RouterLink to="/settings" class="rail-tool settings-button" :aria-label="t('app.nav.settings')" :title="t('app.nav.settings')">
        <icon-mdi-cog-outline aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/about" class="rail-tool" :aria-label="t('app.nav.about')" :title="t('app.nav.about')">
        <icon-mdi-information-outline aria-hidden="true" />
      </RouterLink>
      <button
        type="button"
        class="rail-tool rail-locale ct-mono"
        :aria-label="t('app.nav.switchLocale')"
        :title="t('app.nav.switchLocale')"
        @click="switchLocale"
      >
        {{ locale.toUpperCase() }}
      </button>
      <button
        type="button"
        class="rail-tool rail-collapse"
        :aria-label="collapsed ? t('app.shell.expand') : t('app.shell.collapse')"
        :title="collapsed ? t('app.shell.expand') : t('app.shell.collapse')"
        :aria-expanded="!collapsed"
        @click="emit('toggleCollapse')"
      >
        <icon-mdi-chevron-double-right v-if="collapsed" aria-hidden="true" />
        <icon-mdi-chevron-double-left v-else aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: var(--ct-chassis);
  border-right: 1px solid var(--ct-border);
  font-size: var(--ct-font-size-ui);
  overflow: hidden;
}

/* --- Marque ---------------------------------------------------------------- */

.rail-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: var(--ct-topbar-height);
  padding: 0 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ct-text);
  text-decoration: none;
}

.brand-name {
  font-size: var(--ct-font-size-panel-title);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.brand-version {
  margin-left: auto;
  padding: 0 4px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-micro);
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  line-height: 16px;
}

/* --- Recherche ------------------------------------------------------------- */

.rail-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  height: 32px;
  margin: 0 12px 8px;
  padding: 0 4px 0 8px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-control);
  background: var(--ct-background);
  color: var(--ct-text-muted);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.rail-search:hover {
  border-color: var(--ct-border-strong);
  color: var(--ct-text);
}

.rail-search-label {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-search-kbd {
  flex-shrink: 0;
}

/* --- Sections -------------------------------------------------------------- */

.rail-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 12px 12px;
}

.rail-section + .rail-section {
  margin-top: 16px;
}

.rail-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0;
  padding: 8px 8px 4px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.rail-label:focus {
  outline: none;
}

.rail-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--ct-radius-control);
  color: var(--ct-text-muted);
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.rail-item:hover {
  background: var(--ct-elevated);
  color: var(--ct-text);
}

/* Où l'on est : fond relevé, et l'accent sur ce qui est vivant — l'icône. */
.rail-item--active {
  background: var(--ct-elevated);
  box-shadow: inset 2px 0 0 var(--ct-primary);
  color: var(--ct-text);
}

.rail-item--active .rail-icon {
  color: var(--ct-primary);
}

.rail-icon {
  flex-shrink: 0;
  font-size: 16px;
}

/*
 * Taille explicite : les icônes des outils d'IT-Tools n'en ont pas, et
 * s'étireraient sur toute la largeur disponible.
 */
svg.rail-icon {
  width: 16px;
  height: 16px;
}

.rail-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-count {
  flex-shrink: 0;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  font-variant-numeric: tabular-nums;
}

.rail-empty {
  margin: 0;
  padding: 4px 8px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-secondary);
  line-height: 1.4;
}

/* --- Pied : réglages rapides ---------------------------------------------- */

.rail-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--ct-border);
}

.rail-tool {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--ct-radius-control);
  background: transparent;
  color: var(--ct-text-muted);
  font-size: 16px;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.rail-tool:hover {
  background: var(--ct-elevated);
  color: var(--ct-text);
}

.rail-locale {
  width: auto;
  margin-left: auto;
  padding: 0 8px;
  border: 1px solid var(--ct-border);
  font-size: 11px;
}

/* --- Replié : une colonne d'icônes ---------------------------------------- */

.rail--collapsed .rail-brand {
  justify-content: center;
  padding: 0;
}

.rail--collapsed .rail-search {
  justify-content: center;
  width: 32px;
  margin: 0 auto 8px;
  padding: 0;
}

.rail--collapsed .rail-nav {
  padding: 0 8px 8px;
}

.rail--collapsed .rail-section + .rail-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ct-border);
}

.rail--collapsed .rail-item {
  justify-content: center;
  padding: 0;
}

.rail--collapsed .rail-footer {
  flex-direction: column;
  padding: 8px 0;
}

.rail--collapsed .rail-locale {
  margin-left: 0;
  padding: 0 4px;
}

/* Masqués à l'œil, gardés pour les lecteurs d'écran. */
.rail--collapsed .rail-label,
.rail--collapsed .rail-item-label,
.rail--collapsed .rail-search-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.rail--collapsed .brand-name,
.rail--collapsed .brand-version,
.rail--collapsed .rail-search-kbd,
.rail--collapsed .rail-count {
  display: none;
}

/* En tiroir, le rail s'ouvre et se ferme autrement : pas de repli. */
@media (max-width: 1023.98px) {
  .rail-collapse {
    display: none;
  }
}

/* Au doigt, des cibles de 44 px. */
@media (hover: none) {
  .rail-item,
  .rail-search {
    height: 44px;
  }

  .rail-tool {
    width: 44px;
    height: 44px;
  }

  .brand {
    min-height: 44px;
  }

  /* Cinq boutons de 44 px ne tiennent pas dans 224 : ils passent sur deux lignes. */
  .rail-footer {
    flex-wrap: wrap;
    justify-content: space-between;
    padding: 4px 8px;
  }

  .rail-locale {
    margin-left: 0;
  }
}
</style>
