<script setup lang="ts">
/**
 * Vitrine du design system — page de développement.
 *
 * Elle montre d'un coup d'œil si le kit d'IT-Tools a bien adopté notre palette :
 * les démos affichées ci-dessous sont les leurs, prises telles quelles dans
 * vendor/, mais rendues avec nos surcharges de thème. Basculer le thème depuis
 * l'en-tête doit tout faire changer d'un bloc, sans une trace de leur vert.
 */
import type { Component } from 'vue';
import { useRoute } from 'vue-router';
import { palette } from '~/app/theme';
import { useThemePreference } from '~/app/theme-preference';

const demoModules = import.meta.glob<{ default: Component }>('/vendor/it-tools/src/ui/*/*.demo.vue');

const demos = Object.entries(demoModules)
  .map(([path, load]) => ({
    name: path.split('/').at(-2) ?? path,
    component: defineAsyncComponent(load),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const route = useRoute();
const active = computed(() => demos.find(demo => demo.name === route.params.component) ?? demos[0]);

const { isDark } = useThemePreference();
const tokens = computed(() => (isDark.value ? palette.dark : palette.light));

const swatches = computed(() => [
  ['primary', tokens.value.primary.color],
  ['success', tokens.value.success.color],
  ['warning', tokens.value.warning.color],
  ['error', tokens.value.error.color],
  ['background', tokens.value.background],
  ['surface', tokens.value.surface],
  ['elevated', tokens.value.elevated],
  ['border', tokens.value.border],
  ['text', tokens.value.text],
  ['text muted', tokens.value.textMuted],
]);

const sample = reactive({ text: 'Bonjour', number: 42, enabled: true, checked: false, slider: 30 });
</script>

<template>
  <section>
    <h1 class="page-title">
      Design system
    </h1>
    <p class="lead">
      Palette, composants naive-ui employés par les outils, et démos du kit <code>c-*</code> d'IT-Tools rendues avec nos surcharges.
    </p>

    <h2 class="section-title">
      Palette — thème {{ isDark ? 'sombre' : 'clair' }}
    </h2>
    <div class="swatches">
      <div v-for="[name, value] in swatches" :key="name" class="swatch">
        <span class="swatch-chip" :style="{ background: value }" />
        <span class="swatch-name">{{ name }}</span>
        <code class="swatch-value">{{ value }}</code>
      </div>
    </div>

    <h2 class="section-title">
      naive-ui
    </h2>
    <c-card>
      <n-form label-placement="left" label-width="auto">
        <n-form-item label="Texte">
          <n-input v-model:value="sample.text" />
        </n-form-item>
        <n-form-item label="Nombre">
          <n-input-number v-model:value="sample.number" />
        </n-form-item>
        <n-form-item label="Interrupteur">
          <n-switch v-model:value="sample.enabled" />
        </n-form-item>
        <n-form-item label="Case à cocher">
          <n-checkbox v-model:checked="sample.checked">
            Option
          </n-checkbox>
        </n-form-item>
        <n-form-item label="Curseur">
          <n-slider v-model:value="sample.slider" />
        </n-form-item>
      </n-form>
      <n-space>
        <n-tag type="primary">
          primary
        </n-tag>
        <n-tag type="success">
          success
        </n-tag>
        <n-tag type="warning">
          warning
        </n-tag>
        <n-tag type="error">
          error
        </n-tag>
      </n-space>
      <n-alert type="info" title="Information" mt-4>
        Les alertes suivent la palette.
      </n-alert>
    </c-card>

    <h2 class="section-title">
      Kit IT-Tools
    </h2>
    <div class="demos">
      <nav class="demo-nav">
        <RouterLink
          v-for="demo in demos"
          :key="demo.name"
          :to="`/_design/${demo.name}`"
          class="demo-link"
          :class="{ 'demo-link--active': demo.name === active?.name }"
        >
          {{ demo.name }}
        </RouterLink>
      </nav>
      <div class="demo-stage">
        <component :is="active.component" v-if="active" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-title {
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}

.lead {
  color: var(--ct-text-muted);
  margin: 0 0 32px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ct-text-muted);
  margin: 36px 0 12px;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.swatch {
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: var(--ct-radius-medium);
  background: var(--ct-surface);
  border: 1px solid var(--ct-border);
}

.swatch-chip {
  grid-row: span 2;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--ct-border);
}

.swatch-name {
  font-size: 13px;
  font-weight: 500;
}

.swatch-value {
  font-size: 11px;
  color: var(--ct-text-muted);
}

.demos {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 24px;
}

.demo-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.demo-link {
  padding: 6px 10px;
  border-radius: var(--ct-radius-small);
  color: var(--ct-text);
  text-decoration: none;
  font-size: 13px;
  font-family: var(--ct-font-mono);
}

.demo-link:hover {
  background: var(--ct-neutral-hover);
}

.demo-link--active {
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
}

.demo-stage {
  min-width: 0;
}

@media (max-width: 720px) {
  .demos {
    grid-template-columns: 1fr;
  }

  .demo-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
