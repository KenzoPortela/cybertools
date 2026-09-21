<script setup lang="ts">
/**
 * Paramètres : apparence, comportement des Recettes, données enregistrées dans
 * le navigateur. Tout est local, rien n'est envoyé nulle part.
 */
import { useHead } from '@vueuse/head';
import { NInputNumber, NPopconfirm, NRadioButton, NRadioGroup, NSwitch, useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { SUPPORTED_LOCALES } from '~/app/i18n';
import { useShellCrumbs } from '~/app/shell';
import { COLOR_THEME_IDS, type ColorThemeId, activeColorTheme, colorThemeSwatches } from '~/app/theme';
import { type ThemePreference, useThemePreference } from '~/app/theme-preference';
import { downloadBytes } from '~/integrations/cyberchef/output';
import { useFavoritesStore } from '~/stores/favorites';
import { useRecentsStore } from '~/stores/recents';
import { clearLocalData, exportLocalData, importLocalData, useSettingsStore } from '~/stores/settings';

const { t, locale } = useI18n();
const message = useMessage();
const { preference } = useThemePreference();
const { settings } = storeToRefs(useSettingsStore());
const favorites = useFavoritesStore();
const recents = useRecentsStore();

useHead({ title: () => t('app.settings.title') });
useShellCrumbs(() => [{ label: t('app.nav.settings').toLowerCase() }]);

const themes: ThemePreference[] = ['auto', 'light', 'dark'];
const LOCALE_NAMES: Record<string, string> = { fr: 'Français', en: 'English' };

function exportData() {
  const date = new Date().toISOString().slice(0, 10);
  downloadBytes(exportLocalData(), `cybertools-${date}.json`, 'application/json');
}

const importInput = ref<HTMLInputElement>();

async function importData(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    importLocalData(await file.text());
    // Les stores ont déjà lu le stockage : on recharge pour repartir des
    // valeurs importées partout.
    window.location.reload();
  }
  catch {
    message.error(t('app.settings.data.importError'));
  }
  finally {
    if (importInput.value) importInput.value.value = '';
  }
}

/**
 * Le kit d'IT-Tools calcule ses couleurs au chargement : un nouveau thème de
 * couleur s'applique en rechargeant la page.
 */
function chooseColorTheme(id: ColorThemeId) {
  if (id === activeColorTheme) return;
  settings.value = { ...settings.value, colorTheme: id };
  // Écrit tout de suite : useStorage n'enregistre qu'au prochain cycle, trop
  // tard avant le rechargement.
  localStorage.setItem('cybertools:settings', JSON.stringify(settings.value));
  window.location.reload();
}

function resetAll() {
  clearLocalData();
  window.location.reload();
}
</script>

<template>
  <div class="page">
    <article class="settings">
      <header class="page-head">
        <h1 class="title">
          {{ t('app.settings.title') }}
        </h1>
        <p class="lead">
          {{ t('app.settings.intro') }}
        </p>
      </header>

      <section class="group" aria-labelledby="settings-appearance">
        <h2 id="settings-appearance" class="group-title">
          {{ t('app.settings.appearance.title') }}
        </h2>

        <div class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.appearance.theme') }}</span>
            <span class="row-help">{{ t('app.settings.appearance.themeHelp') }}</span>
          </div>
          <NRadioGroup v-model:value="preference" size="small" class="setting-theme">
            <NRadioButton v-for="theme in themes" :key="theme" :value="theme">
              {{ t(`app.settings.appearance.themes.${theme}`) }}
            </NRadioButton>
          </NRadioGroup>
        </div>

        <div class="row row--stack">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.appearance.color') }}</span>
            <span class="row-help">{{ t('app.settings.appearance.colorHelp') }}</span>
          </div>
          <div class="swatches" role="radiogroup" :aria-label="t('app.settings.appearance.color')">
            <button
              v-for="id in COLOR_THEME_IDS"
              :key="id"
              type="button"
              role="radio"
              class="swatch"
              :class="{ 'swatch--active': id === activeColorTheme }"
              :aria-checked="id === activeColorTheme"
              :data-theme="id"
              @click="chooseColorTheme(id)"
            >
              <span class="swatch-preview" :style="{ background: colorThemeSwatches[id].background }" aria-hidden="true">
                <span class="swatch-prompt ct-mono" :style="{ color: colorThemeSwatches[id].dark }">&gt;_</span>
                <span class="swatch-dot" :style="{ background: colorThemeSwatches[id].light }" />
              </span>
              <span class="swatch-name">{{ t(`app.settings.appearance.colors.${id}`) }}</span>
            </button>
          </div>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.appearance.language') }}</span>
            <span class="row-help">{{ t('app.settings.appearance.languageHelp') }}</span>
          </div>
          <NRadioGroup v-model:value="locale" size="small" class="setting-locale">
            <NRadioButton v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
              {{ LOCALE_NAMES[code] }}
            </NRadioButton>
          </NRadioGroup>
        </div>

        <label class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.appearance.railCollapsed') }}</span>
            <span class="row-help">{{ t('app.settings.appearance.railCollapsedHelp') }}</span>
          </div>
          <NSwitch v-model:value="settings.shellRailCollapsed" class="setting-rail-collapsed" />
        </label>
      </section>

      <section class="group" aria-labelledby="settings-recipes">
        <h2 id="settings-recipes" class="group-title">
          {{ t('app.settings.recipes.title') }}
        </h2>

        <label class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.recipes.autoBake') }}</span>
            <span class="row-help">{{ t('app.settings.recipes.autoBakeHelp') }}</span>
          </div>
          <NSwitch v-model:value="settings.autoBake" class="setting-auto-bake" />
        </label>

        <label class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.recipes.restoreLast') }}</span>
            <span class="row-help">{{ t('app.settings.recipes.restoreLastHelp') }}</span>
          </div>
          <NSwitch v-model:value="settings.recipesRestoreLast" class="setting-restore-last" />
        </label>
      </section>

      <section class="group" aria-labelledby="settings-magic">
        <h2 id="settings-magic" class="group-title">
          {{ t('app.settings.magic.title') }}
        </h2>

        <label class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.magic.autoDepth') }}</span>
            <span class="row-help">{{ t('app.settings.magic.autoDepthHelp') }}</span>
          </div>
          <NSwitch v-model:value="settings.magicAutoDepth" class="setting-magic-auto" />
        </label>

        <div class="row" :class="{ 'row--muted': settings.magicAutoDepth }">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.magic.depth') }}</span>
            <span class="row-help">{{ t('app.settings.magic.depthHelp') }}</span>
          </div>
          <NInputNumber v-model:value="settings.magicDepth" :min="1" :max="10" size="small" class="setting-magic-depth" :disabled="settings.magicAutoDepth" :aria-label="t('app.settings.magic.depth')" />
        </div>

        <label class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.magic.intensive') }}</span>
            <span class="row-help">{{ t('app.settings.magic.intensiveHelp') }}</span>
          </div>
          <NSwitch v-model:value="settings.magicIntensive" class="setting-magic-intensive" />
        </label>
      </section>

      <section class="group" aria-labelledby="settings-data">
        <h2 id="settings-data" class="group-title">
          {{ t('app.settings.data.title') }}
        </h2>

        <div class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.data.favorites', { count: favorites.ids.length }, favorites.ids.length) }}</span>
          </div>
          <c-button size="small" :disabled="!favorites.ids.length" class="clear-favorites" @click="favorites.ids = []">
            {{ t('app.settings.data.clear') }}
          </c-button>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.data.recents', { count: recents.ids.length }, recents.ids.length) }}</span>
            <span class="row-help">{{ t('app.settings.data.recentsHelp') }}</span>
          </div>
          <c-button size="small" :disabled="!recents.ids.length" class="clear-recents" @click="recents.clear()">
            {{ t('app.settings.data.clear') }}
          </c-button>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.data.backup') }}</span>
            <span class="row-help">{{ t('app.settings.data.backupHelp') }}</span>
          </div>
          <div class="row-actions">
            <c-button size="small" class="export" @click="exportData">
              <icon-mdi-download class="button-icon" aria-hidden="true" />
              {{ t('app.settings.data.export') }}
            </c-button>
            <c-button size="small" class="import" @click="importInput?.click()">
              <icon-mdi-upload class="button-icon" aria-hidden="true" />
              {{ t('app.settings.data.import') }}
            </c-button>
            <input ref="importInput" type="file" accept="application/json,.json" hidden @change="importData">
          </div>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">{{ t('app.settings.data.reset') }}</span>
            <span class="row-help">{{ t('app.settings.data.resetHelp') }}</span>
          </div>
          <NPopconfirm :positive-text="t('app.settings.data.resetConfirm')" :negative-text="t('app.settings.data.cancel')" @positive-click="resetAll">
            <template #trigger>
              <c-button size="small" class="reset">
                {{ t('app.settings.data.reset') }}
              </c-button>
            </template>
            {{ t('app.settings.data.resetQuestion') }}
          </NPopconfirm>
        </div>

        <p class="note">
          <icon-mdi-shield-lock-outline class="note-icon" aria-hidden="true" />
          {{ t('app.settings.data.privacy') }}
        </p>
      </section>
    </article>
  </div>
</template>

<style scoped>
.settings {
  max-width: 760px;
  margin: 0 auto;
}

.title {
  font-size: clamp(26px, 4vw, 34px);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 8px 0 8px;
}

.lead {
  margin: 0 0 28px;
  color: var(--ct-text-muted);
  line-height: 1.6;
}

.group {
  margin-bottom: 24px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-large);
  background: var(--ct-surface);
  overflow: hidden;
}

.group-title {
  margin: 0;
  padding: 14px 18px;
  font-family: var(--ct-font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ct-text-muted);
  border-bottom: 1px solid var(--ct-border);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ct-border);
}

.row:last-child {
  border-bottom: none;
}

label.row {
  cursor: pointer;
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.row-label {
  font-weight: 550;
}

.row-help {
  font-size: 13px;
  color: var(--ct-text-muted);
  line-height: 1.5;
}

.row--muted .row-text {
  opacity: 0.55;
}

.setting-magic-depth {
  width: 110px;
  flex-shrink: 0;
}

.row--stack {
  flex-direction: column;
  align-items: stretch;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
}

.swatch {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-background);
  color: var(--ct-text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.swatch:hover {
  border-color: var(--ct-text-muted);
}

.swatch--active {
  border-color: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.swatch-preview {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 46px;
  padding: 6px 8px;
  border-radius: var(--ct-radius);
}

.swatch-prompt {
  font-size: 14px;
  font-weight: 700;
}

.swatch-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 85%);
}

.swatch-name {
  padding: 0 2px;
  font-weight: 550;
}

.row-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.button-icon {
  margin-right: 6px;
}

.note {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 0;
  padding: 12px 18px 16px;
  font-size: 13px;
  color: var(--ct-text-muted);
  line-height: 1.5;
}

.note-icon {
  flex-shrink: 0;
  font-size: 16px;
  margin-top: 1px;
  color: var(--ct-primary);
}

@media (max-width: 640px) {
  .row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
