<script setup lang="ts">
import { useHead } from '@vueuse/head';
import { NConfigProvider, NGlobalStyle, NMessageProvider, NNotificationProvider, darkTheme, dateEnUS, dateFrFR, enUS, frFR } from 'naive-ui';
import { RouterView } from 'vue-router';
import { useThemePreference } from '~/app/theme-preference';
import { applyCssVariables, darkThemeOverrides, lightThemeOverrides, palette } from '~/app/theme';
import AppShell from '~/layouts/AppShell.vue';

const { isDark } = useThemePreference();

const theme = computed(() => (isDark.value ? darkTheme : null));
const themeOverrides = computed(() => (isDark.value ? darkThemeOverrides : lightThemeOverrides));

watchEffect(() => applyCssVariables(isDark.value ? palette.dark : palette.light));

const { locale } = useI18n();
syncRef(locale, useStorage('locale', locale));
watchEffect(() => {
  document.documentElement.lang = locale.value;
});

// Chaque page fixe son propre titre ; celui-ci l'habille.
useHead({
  titleTemplate: (title?: string) => (title ? `${title} — cybertools` : 'cybertools'),
});

// Libellés internes de naive-ui (sélecteurs de date, pagination…) dans la bonne langue.
const naiveLocale = computed(() => (locale.value === 'fr' ? frFR : enUS));
const naiveDateLocale = computed(() => (locale.value === 'fr' ? dateFrFR : dateEnUS));
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <NGlobalStyle />
    <NMessageProvider placement="bottom">
      <NNotificationProvider placement="bottom-right">
        <AppShell>
          <RouterView />
        </AppShell>
      </NNotificationProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
html,
body {
  min-height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background: var(--ct-background);
  color: var(--ct-text);
  font-family: var(--ct-font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

code,
kbd,
pre,
samp {
  font-family: var(--ct-font-mono);
}

a {
  color: var(--ct-primary);
}

:focus-visible {
  outline: 2px solid var(--ct-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
