<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { installCommandPaletteShortcuts, paletteShortcutLabel, useCommandPalette } from '~/app/command-palette';
import { AUTHOR } from '~/app/author';
import { useThemePreference } from '~/app/theme-preference';
import AppLogo from '~/components/AppLogo.vue';
import CommandPalette from '~/components/CommandPalette.vue';

const { t } = useI18n();
const { preference, cycle } = useThemePreference();
const { open: openPalette } = useCommandPalette();

installCommandPaletteShortcuts();

const themeLabel = computed(() => t(`app.theme.${preference.value}`));
const version = __APP_VERSION__;
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="container header-inner">
        <RouterLink to="/" class="brand" :aria-label="t('app.nav.home')">
          <AppLogo :size="26" />
          <span class="brand-name ct-mono">cybertools</span>
        </RouterLink>

        <button type="button" class="search-trigger" :aria-label="t('app.palette.open')" @click="openPalette">
          <icon-mdi-magnify class="search-trigger-icon" aria-hidden="true" />
          <span class="search-trigger-label">{{ t('app.palette.trigger') }}</span>
          <kbd class="search-trigger-kbd">{{ paletteShortcutLabel }}</kbd>
        </button>

        <div class="header-actions">
          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <NButton quaternary circle :aria-label="themeLabel" @click="cycle">
                <icon-mdi-theme-light-dark v-if="preference === 'auto'" class="icon" />
                <icon-mdi-white-balance-sunny v-else-if="preference === 'light'" class="icon" />
                <icon-mdi-weather-night v-else class="icon" />
              </NButton>
            </template>
            {{ themeLabel }}
          </NTooltip>

          <NTooltip trigger="hover" placement="bottom">
            <template #trigger>
              <RouterLink v-slot="{ navigate, href }" to="/settings" custom>
                <NButton quaternary circle tag="a" :href="href" class="settings-button" :aria-label="t('app.nav.settings')" @click="navigate">
                  <icon-mdi-cog-outline class="icon" />
                </NButton>
              </RouterLink>
            </template>
            {{ t('app.nav.settings') }}
          </NTooltip>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="container">
        <slot />
      </div>
    </main>

    <CommandPalette />

    <footer class="footer">
      <div class="container footer-inner">
        <span class="status">
          <span class="status-dot" aria-hidden="true" />
          {{ t('app.footer.privacy') }}
        </span>
        <span class="footer-meta">
          <span>v{{ version }}</span>
          <span aria-hidden="true">·</span>
          <span>GPL-3.0</span>
          <span aria-hidden="true">·</span>
          <i18n-t keypath="app.footer.madeBy" tag="span" scope="global">
            <template #name>
              <a :href="AUTHOR.github" target="_blank" rel="noopener noreferrer" class="footer-link footer-author">{{ AUTHOR.name }}</a>
            </template>
          </i18n-t>
          <span aria-hidden="true">·</span>
          <RouterLink to="/about" class="footer-link">
            {{ t('app.footer.about') }}
          </RouterLink>
        </span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ct-background);
}

.container {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 60px;
  display: flex;
  align-items: center;
  background: color-mix(in srgb, var(--ct-surface) 85%, transparent);
  backdrop-filter: saturate(160%) blur(10px);
  border-bottom: 1px solid var(--ct-border);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ct-text);
  text-decoration: none;
}

.brand-name {
  font-weight: 650;
  font-size: 17px;
  letter-spacing: -0.02em;
}

.search-trigger {
  flex: 0 1 340px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 8px 0 12px;
  margin-left: auto;
  border-radius: var(--ct-radius-pill);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
  color: var(--ct-text-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.search-trigger:hover {
  border-color: var(--ct-primary);
  color: var(--ct-text);
}

.search-trigger-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.search-trigger-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-trigger-kbd {
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon {
  font-size: 18px;
}

.main {
  flex: 1;
  padding: 32px 0 64px;
}

/* Pied de page en barre d'état : l'essentiel, en une ligne. */
.footer {
  border-top: 1px solid var(--ct-border);
  background: var(--ct-surface);
  padding: 12px 0;
  font-family: var(--ct-font-mono);
  font-size: 12px;
  color: var(--ct-text-muted);
}

.footer-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 24px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.footer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.footer-link {
  color: inherit;
  text-decoration: none;
}

.footer-author {
  color: var(--ct-text);
}

.footer-link:hover {
  color: var(--ct-primary);
}

@media (max-width: 640px) {
  /* Sur téléphone, la loupe seule : la place manque et il n'y a pas de clavier. */
  .search-trigger {
    flex: 0 0 auto;
    width: 36px;
    padding: 0;
    justify-content: center;
    border-color: transparent;
    background: transparent;
  }

  .search-trigger-label,
  .search-trigger-kbd {
    display: none;
  }

  .container {
    padding: 0 14px;
  }

  .main {
    padding: 20px 0 48px;
  }
}
</style>
