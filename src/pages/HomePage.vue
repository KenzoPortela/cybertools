<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router';
import { NInput } from 'naive-ui';
import { useRouter } from 'vue-router';
import { paletteShortcutLabel } from '~/app/command-palette';
import { catalog } from '~/catalog/catalog';
import { categories } from '~/catalog/categories';
import { registry } from '~/catalog/registry';
import ToolCard from '~/components/ToolCard.vue';
import { useFavoritesStore } from '~/stores/favorites';
import { useRecentsStore } from '~/stores/recents';

const { t } = useI18n();
const router = useRouter();
const favorites = useFavoritesStore();
const recents = useRecentsStore();

// Dans l'URL : une recherche se partage et survit au bouton « retour ».
const query = useRouteQuery<string>('q', '', { mode: 'replace' });

const results = computed(() => catalog.search(query.value ?? ''));
const searching = computed(() => (query.value ?? '').trim().length > 0);
const recentTools = computed(() => recents.tools.slice(0, 6));

// Pas de focus automatique sur un écran tactile : il ferait surgir le clavier.
const autofocus = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function openFirstResult() {
  const first = results.value[0];
  if (first) router.push(`/tools/${first.slug}`);
}
</script>

<template>
  <section class="hero">
    <div class="hero-grid" aria-hidden="true" />

    <p class="eyebrow ct-mono">
      <span class="eyebrow-dot" aria-hidden="true" />
      {{ t('app.home.eyebrow', { count: registry.tools.length }) }}
    </p>
    <h1 class="hero-title">
      {{ t('app.home.title') }}
    </h1>
    <p class="hero-subtitle">
      {{ t('app.home.subtitle', { count: registry.tools.length }) }}
    </p>

    <div class="search">
      <NInput
        v-model:value="query"
        size="large"
        round
        clearable
        class="search-input"
        :autofocus="autofocus"
        :placeholder="t('app.home.searchPlaceholder')"
        :input-props="{ 'aria-label': t('app.home.searchPlaceholder'), 'type': 'search' }"
        @keydown.enter="openFirstResult"
      >
        <template #prefix>
          <span class="prompt ct-mono" aria-hidden="true">&gt;</span>
        </template>
      </NInput>
      <p class="search-hint">
        <i18n-t keypath="app.home.paletteHint" tag="span" scope="global">
          <template #shortcut>
            <kbd>{{ paletteShortcutLabel }}</kbd>
          </template>
        </i18n-t>
      </p>
    </div>
  </section>

  <section v-if="searching" :aria-label="t('app.home.results')">
    <h2 class="section-title ct-mono">
      {{ t('app.home.resultCount', { count: results.length, query: query.trim() }, results.length) }}
    </h2>
    <div v-if="results.length" class="grid">
      <ToolCard v-for="tool in results" :key="tool.id" :tool="tool" show-category />
    </div>
    <p v-else class="empty">
      {{ t('app.home.noResult') }}
    </p>
  </section>

  <template v-else>
    <section class="featured" :aria-label="t('app.home.featured')">
      <RouterLink to="/tools/recipes" class="feature feature--primary">
        <span class="feature-icon" aria-hidden="true"><icon-mdi-chef-hat /></span>
        <span class="feature-body">
          <span class="feature-tag ct-mono">{{ t('app.home.recipesTag') }}</span>
          <span class="feature-title">{{ t('app.native.recipes.title') }}</span>
          <span class="feature-text">{{ t('app.home.recipesPitch') }}</span>
        </span>
        <icon-mdi-arrow-right class="feature-arrow" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/tools/magic" class="feature">
        <span class="feature-icon" aria-hidden="true"><icon-mdi-auto-fix /></span>
        <span class="feature-body">
          <span class="feature-tag ct-mono">{{ t('app.home.magicTag') }}</span>
          <span class="feature-title">{{ t('app.native.magic.title') }}</span>
          <span class="feature-text">{{ t('app.home.magicPitch') }}</span>
        </span>
        <icon-mdi-arrow-right class="feature-arrow" aria-hidden="true" />
      </RouterLink>
    </section>

    <section v-if="favorites.tools.length" class="block">
      <h2 class="section-title ct-mono">
        {{ t('app.home.favorites') }}
        <span class="section-count">{{ favorites.tools.length }}</span>
      </h2>
      <div class="grid">
        <ToolCard v-for="tool in favorites.tools" :key="tool.id" :tool="tool" show-category />
      </div>
    </section>

    <section v-if="recentTools.length" class="block">
      <div class="section-head">
        <h2 class="section-title ct-mono">
          {{ t('app.home.recents') }}
        </h2>
        <button type="button" class="link-button ct-mono" @click="recents.clear()">
          {{ t('app.home.clearRecents') }}
        </button>
      </div>
      <div class="grid">
        <ToolCard v-for="tool in recentTools" :key="tool.id" :tool="tool" show-category />
      </div>
    </section>

    <section class="block">
      <h2 class="section-title ct-mono">
        {{ t('app.home.categories') }}
        <span class="section-count">{{ categories.length }}</span>
      </h2>
      <div class="categories">
        <RouterLink
          v-for="category in categories"
          :key="category.id"
          :to="`/categories/${category.id}`"
          class="category-card"
        >
          <span class="category-icon" aria-hidden="true">
            <component :is="category.icon" />
          </span>
          <span class="category-text">
            <span class="category-label">{{ t(category.labelKey) }}</span>
            <span class="category-count ct-mono">{{ t('app.category.count', registry.countByCategory.get(category.id) ?? 0) }}</span>
          </span>
        </RouterLink>
      </div>
    </section>
  </template>
</template>

<style scoped>
.hero {
  position: relative;
  /* Contexte d'empilement propre : la trame (z-index -1) reste devant le fond de page. */
  isolation: isolate;
  text-align: center;
  padding: 48px 0 40px;
}

/*
 * Trame de points discrète derrière le haut de page, estompée vers les bords :
 * une texture de papier millimétré, pas un décor.
 */
.hero-grid {
  position: absolute;
  inset: -32px -20px 0;
  z-index: -1;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--ct-text-muted) 28%, transparent) 1px, transparent 1.3px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 60% 70% at 50% 40%, #000 30%, transparent 100%);
  pointer-events: none;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  padding: 5px 12px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-pill);
  background: var(--ct-surface);
  font-size: 12px;
  color: var(--ct-text-muted);
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.hero-title {
  font-size: clamp(32px, 5.5vw, 52px);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.08;
  margin: 0 0 14px;
}

.hero-subtitle {
  margin: 0 auto;
  max-width: 56ch;
  font-size: 16px;
  line-height: 1.6;
  color: var(--ct-text-muted);
}

.search {
  max-width: 640px;
  margin: 30px auto 0;
  /* Le bandeau est centré ; le texte saisi, lui, se lit de gauche à droite. */
  text-align: left;
}

.search-input {
  box-shadow: var(--ct-shadow);
}

.search-input :deep(input) {
  font-family: var(--ct-font-mono);
  font-size: 15px;
}

.prompt {
  font-size: 17px;
  font-weight: 700;
  color: var(--ct-primary);
  margin-right: 2px;
}

.search-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--ct-text-muted);
  text-align: center;
}

/* Un raccourci clavier n'a pas de sens sur un écran tactile. */
@media (hover: none) {
  .search-hint {
    display: none;
  }
}

.block {
  margin-bottom: 40px;
}

.featured {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 12px;
  margin-bottom: 40px;
}

@media (max-width: 720px) {
  .featured {
    grid-template-columns: minmax(0, 1fr);
  }
}

.feature {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
  color: var(--ct-text);
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.feature:hover {
  border-color: var(--ct-primary);
}

.feature--primary {
  background: linear-gradient(120deg, var(--ct-primary-faded), transparent 65%), var(--ct-surface);
}

.feature-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-primary-faded);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 22px;
}

.feature-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.feature-tag {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ct-primary);
}

.feature-title {
  font-size: 17px;
  font-weight: 650;
}

.feature-text {
  font-size: 13px;
  line-height: 1.45;
  color: var(--ct-text-muted);
}

.feature-arrow {
  flex-shrink: 0;
  color: var(--ct-text-muted);
  transition: transform 0.15s ease, color 0.15s ease;
}

.feature:hover .feature-arrow {
  color: var(--ct-primary);
  transform: translateX(3px);
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ct-text-muted);
  margin: 0 0 14px;
}

/* Un filet prolonge le titre de section jusqu'au bord. */
.section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--ct-border);
}

.section-head .section-title {
  flex: 1;
}

.section-count {
  padding: 0 7px;
  border-radius: var(--ct-radius-pill);
  background: var(--ct-neutral);
  font-size: 11px;
  letter-spacing: 0;
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  color: var(--ct-text-muted);
  cursor: pointer;
}

.link-button:hover {
  color: var(--ct-primary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.empty {
  color: var(--ct-text-muted);
  text-align: center;
  padding: 24px 0;
}

.categories {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

@media (max-width: 480px) {
  .categories {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .category-card {
    padding: 12px;
  }
}

.category-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
  color: var(--ct-text);
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.category-card:hover {
  border-color: var(--ct-primary);
}

.category-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-border);
  color: var(--ct-primary);
  font-size: 18px;
  transition: background-color 0.15s ease;
}

.category-card:hover .category-icon {
  background: var(--ct-primary-faded);
}

.category-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.category-label {
  font-weight: 550;
  line-height: 1.3;
}

.category-count {
  font-size: 11px;
  color: var(--ct-text-muted);
}
</style>
