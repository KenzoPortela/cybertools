<script setup lang="ts">
/**
 * Vitrine du design system — page de développement.
 *
 * Elle montre d'un coup d'œil si le kit d'IT-Tools a bien adopté notre palette :
 * les démos affichées ci-dessous sont les leurs, prises telles quelles dans
 * vendor/, mais rendues avec nos surcharges de thème. Basculer le thème depuis
 * le rail doit tout faire changer d'un bloc, sans une trace de leur vert.
 */
import type { Component } from 'vue';
import { useRoute } from 'vue-router';
import { useShellCrumbs } from '~/app/shell';
import { fontSizes, palette, radii } from '~/app/theme';
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

useShellCrumbs([{ label: '_design' }]);

const tokens = computed(() => (isDark.value ? palette.dark : palette.light));

const accents = computed(() => [
  ['primary', tokens.value.primary.color],
  ['success', tokens.value.success.color],
  ['warning', tokens.value.warning.color],
  ['error', tokens.value.error.color],
]);

/** Les dix neutres, dans l'ordre des plans : du châssis au texte le plus pâle. */
const neutrals = computed(() => [
  ['chassis', tokens.value.chassis],
  ['background', tokens.value.background],
  ['surface', tokens.value.surface],
  ['surface-raised', tokens.value.surfaceRaised],
  ['elevated', tokens.value.elevated],
  ['border', tokens.value.border],
  ['border-strong', tokens.value.borderStrong],
  ['text', tokens.value.text],
  ['text-muted', tokens.value.textMuted],
  ['text-faint', tokens.value.textFaint],
]);

/** Un palier par taille d'objet : c'est la taille de la vignette qui le justifie. */
const radiusSteps = [
  { name: 'micro', value: radii.micro, usage: 'kbd, case à cocher, pastille', size: 34 },
  { name: 'control', value: radii.control, usage: 'bouton, champ, onglet, ligne', size: 48 },
  { name: 'panel', value: radii.panel, usage: 'carte, panneau, bloc', size: 72 },
  { name: 'float', value: radii.float, usage: 'palette, modale, menu', size: 96 },
  { name: 'pill', value: radii.pill, usage: 'interrupteur, barre ronde', size: 48 },
];

const typeSteps = [
  { label: `${fontSizes.pageTitle} / 600`, sample: 'Titre de page', style: { fontSize: fontSizes.pageTitle, fontWeight: 600 } },
  { label: `${fontSizes.panelTitle} / 600`, sample: 'Titre de panneau', style: { fontSize: fontSizes.panelTitle, fontWeight: 600 } },
  { label: `${fontSizes.ui} / 400`, sample: "Texte d'interface — la base du châssis", style: { fontSize: fontSizes.ui } },
  { label: `${fontSizes.secondary} / 400`, sample: 'Secondaire, descriptions', style: { fontSize: fontSizes.secondary } },
  { label: `${fontSizes.data} mono`, sample: 'donnée : 48 65 6c 6c 6f', style: { fontSize: fontSizes.data, fontFamily: 'var(--ct-font-mono)' } },
  { label: `${fontSizes.label} mono`, sample: 'ÉTIQUETTE DE SECTION', style: { fontSize: fontSizes.label, fontFamily: 'var(--ct-font-mono)', letterSpacing: '0.12em' } },
];

/** Rythme d'espacement : ces six valeurs, et aucune valeur intermédiaire. */
const spacing = [
  [4, 'icône ↔ texte serré'],
  [8, 'dans un contrôle'],
  [12, 'entre contrôles'],
  [16, 'entre panneaux'],
  [24, 'marge de page'],
  [32, 'entre blocs majeurs'],
] as const;

const sample = reactive({ text: 'Bonjour', number: 42, enabled: true, checked: false, slider: 30 });
</script>

<template>
  <section class="page">
    <h1 class="page-title">
      Design system
    </h1>
    <p class="lead">
      Palette, composants naive-ui employés par les outils, et démos du kit <code>c-*</code> d'IT-Tools rendues avec nos surcharges.
    </p>

    <h2 class="section-title">
      Accents — thème {{ isDark ? 'sombre' : 'clair' }}
    </h2>
    <div class="swatches">
      <div v-for="[name, value] in accents" :key="name" class="swatch">
        <span class="swatch-chip" :style="{ background: value }" />
        <span class="swatch-name">{{ name }}</span>
        <code class="swatch-value">{{ value }}</code>
      </div>
    </div>

    <h2 class="section-title">
      Neutres — du châssis au texte
    </h2>
    <div class="swatches">
      <div v-for="[name, value] in neutrals" :key="name" class="swatch">
        <span class="swatch-chip" :style="{ background: value }" />
        <span class="swatch-name">{{ name }}</span>
        <code class="swatch-value">{{ value }}</code>
      </div>
    </div>

    <h2 class="section-title">
      Rayons — un palier par taille d'objet
    </h2>
    <div class="radii">
      <div v-for="step in radiusSteps" :key="step.name" class="radius">
        <span
          class="radius-chip"
          :style="{ borderRadius: step.value, width: `${step.size}px`, height: `${step.size}px` }"
        />
        <span class="radius-name">{{ step.name }} · {{ step.value }}</span>
        <span class="radius-usage">{{ step.usage }}</span>
      </div>
    </div>

    <h2 class="section-title">
      Échelle typographique
    </h2>
    <div class="type-scale">
      <div v-for="step in typeSteps" :key="step.label" class="type-step">
        <code class="type-label">{{ step.label }}</code>
        <span :style="step.style">{{ step.sample }}</span>
      </div>
    </div>

    <h2 class="section-title">
      Rythme — six valeurs, pas d'intermédiaire
    </h2>
    <div class="spacing">
      <div v-for="[value, usage] in spacing" :key="value" class="spacing-step">
        <code class="spacing-label">{{ value }}px</code>
        <span class="spacing-bar" :style="{ width: `${value}px` }" />
        <span class="spacing-usage">{{ usage }}</span>
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

.radii {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 24px;
}

.radius {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.radius-chip {
  background: var(--ct-elevated);
  border: 1px solid var(--ct-border-strong);
  margin-bottom: 8px;
}

.radius-name {
  font-family: var(--ct-font-mono);
  font-size: var(--ct-font-size-secondary);
}

.radius-usage {
  font-size: var(--ct-font-size-secondary);
  color: var(--ct-text-faint);
}

.type-scale {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.type-step {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: baseline;
  gap: 16px;
}

.type-label {
  font-size: var(--ct-font-size-secondary);
  color: var(--ct-text-faint);
  text-align: right;
}

.spacing {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spacing-step {
  display: grid;
  grid-template-columns: 48px 32px 1fr;
  align-items: center;
  gap: 12px;
}

.spacing-label {
  font-size: var(--ct-font-size-secondary);
  color: var(--ct-text-faint);
  text-align: right;
}

.spacing-bar {
  height: 10px;
  border-radius: var(--ct-radius-micro);
  background: var(--ct-primary);
}

.spacing-usage {
  font-size: var(--ct-font-size-ui);
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
