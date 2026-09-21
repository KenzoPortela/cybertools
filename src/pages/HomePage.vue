<script setup lang="ts">
import { useNow } from '@vueuse/core';
import { useRouteQuery } from '@vueuse/router';
import { storeToRefs } from 'pinia';
import { RouterLink, useRouter } from 'vue-router';
import { paletteShortcutLabel } from '~/app/command-palette';
import { useShellCrumbs, useShellStatus } from '~/app/shell';
import { catalog } from '~/catalog/catalog';
import { categories } from '~/catalog/categories';
import { registry } from '~/catalog/registry';
import type { LocalizedTool } from '~/catalog/tool.types';
import ToolRow from '~/components/ToolRow.vue';
import { formatBytes } from '~/integrations/cyberchef/output';
import { useRecentsStore } from '~/stores/recents';
import { useSessionStore } from '~/stores/session';

/**
 * Accueil en lanceur, pas en vitrine : une barre de commande, les trois
 * espaces de l'atelier, et ce qu'on a ouvert — pour reprendre là où on en était.
 * Un outil ouvert dix fois par jour n'a pas besoin d'un titre d'affiche.
 */
const { t, locale } = useI18n();
const router = useRouter();
const recents = useRecentsStore();
const { operations, bytesProcessed, networkRequests } = storeToRefs(useSessionStore());

useShellCrumbs(() => [{ label: t('app.nav.home').toLowerCase() }]);
useShellStatus(() => [{ text: t('app.status.indexed', registry.tools.length) }]);

// --- Recherche -----------------------------------------------------------------

// Dans l'URL : une recherche se partage et survit au bouton « retour ».
const query = useRouteQuery<string>('q', '', { mode: 'replace' });

const results = computed(() => catalog.search(query.value ?? ''));
const searching = computed(() => (query.value ?? '').trim().length > 0);

// Pas de focus automatique sur un écran tactile : il ferait surgir le clavier.
const autofocus = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function openFirstResult() {
  const first = results.value[0];
  if (first) router.push(`/tools/${first.slug}`);
}

// --- Atelier -------------------------------------------------------------------

/** Des faits vérifiables seulement : le nombre d'opérations est compté, pas écrit. */
const cyberchefOperations = registry.tools.filter(tool => tool.source === 'cyberchef').length;

const tiles = computed(() => [
  { id: 'recipes', text: t('app.home.tiles.recipes.text'), meta: t('app.home.tiles.recipes.meta', { count: cyberchefOperations }) },
  { id: 'magic', text: t('app.home.tiles.magic.text'), meta: t('app.home.tiles.magic.meta') },
  { id: 'stego-lab', text: t('app.home.tiles.stego.text'), meta: t('app.home.tiles.stego.meta') },
]
  .map(tile => ({ ...tile, tool: catalog.byId.value.get(tile.id) }))
  .filter((tile): tile is typeof tile & { tool: LocalizedTool } => Boolean(tile.tool)));

// --- Reprendre, les plus utilisés ---------------------------------------------

const resume = computed(() => recents.used.slice(0, 9));
const mostUsed = computed(() => recents.mostUsed.slice(0, 5));
const topCount = computed(() => mostUsed.value[0]?.count ?? 1);

// Une minute de précision suffit : « 2 min » n'a pas besoin de battre la seconde.
const now = useNow({ interval: 30_000 });

/** `2 min`, `3 h`, `4 j` ; un tiret quand la date est inconnue (ancien format). */
function ago(at: number) {
  if (!at) return '—';
  const minutes = Math.max(0, Math.floor((now.value.getTime() - at) / 60_000));
  if (minutes < 1) return t('app.home.justNow');
  const [unit, value] = minutes < 60
    ? ['minute', minutes]
    : minutes < 1440 ? ['hour', Math.floor(minutes / 60)] : ['day', Math.floor(minutes / 1440)];
  return new Intl.NumberFormat(locale.value, { style: 'unit', unit: unit as string, unitDisplay: 'short' }).format(value as number);
}

function exactDate(at: number) {
  return at ? new Date(at).toLocaleString(locale.value) : t('app.home.dateUnknown');
}
</script>

<template>
  <div class="page home">
    <h1 class="sr-only">
      {{ t('app.home.title') }}
    </h1>

    <form class="command" role="search" @submit.prevent>
      <span class="command-prompt ct-mono" aria-hidden="true">›</span>
      <input
        v-model="query"
        type="search"
        class="command-input ct-mono"
        :placeholder="t('app.home.searchPlaceholder')"
        :aria-label="t('app.home.searchPlaceholder')"
        :autofocus="autofocus"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter.prevent="openFirstResult"
      >
      <span class="command-hint">
        <kbd>{{ paletteShortcutLabel }}</kbd>
        {{ t('app.home.anywhere') }}
      </span>
    </form>

    <section v-if="searching" class="results" aria-labelledby="home-results">
      <h2 id="home-results" class="section-label ct-mono">
        {{ t('app.home.resultCount', { count: results.length, query: query.trim() }, results.length) }}
      </h2>
      <ul v-if="results.length" class="panel rows">
        <li v-for="tool in results" :key="tool.id">
          <ToolRow :tool="tool" description />
        </li>
      </ul>
      <p v-else class="panel empty">
        {{ t('app.home.noResult') }}
      </p>
    </section>

    <template v-else>
      <nav class="tiles" :aria-label="t('app.shell.workbench')">
        <RouterLink v-for="tile in tiles" :key="tile.id" :to="`/tools/${tile.tool.slug}`" class="tile">
          <span class="tile-icon" aria-hidden="true">
            <component :is="tile.tool.icon" />
          </span>
          <span class="tile-body">
            <span class="tile-title">{{ tile.tool.localizedTitle }}</span>
            <span class="tile-text">{{ tile.text }}</span>
            <span class="tile-meta ct-mono">{{ tile.meta }}</span>
          </span>
        </RouterLink>
      </nav>

      <div class="dashboard">
        <section class="resume" aria-labelledby="home-resume">
          <div class="section-head">
            <h2 id="home-resume" class="section-label ct-mono">
              {{ t('app.home.resume') }}
            </h2>
            <span class="section-rule" aria-hidden="true" />
            <button v-if="resume.length" type="button" class="link-button ct-mono" @click="recents.clear()">
              {{ t('app.home.clearRecents') }}
            </button>
          </div>
          <ul v-if="resume.length" class="panel rows">
            <li v-for="item in resume" :key="item.tool.id">
              <ToolRow :tool="item.tool" :meta="ago(item.at)" :meta-title="exactDate(item.at)" />
            </li>
          </ul>
          <p v-else class="panel empty">
            {{ t('app.home.resumeEmpty') }}
          </p>
        </section>

        <aside class="side">
          <section aria-labelledby="home-most-used">
            <div class="section-head">
              <h2 id="home-most-used" class="section-label ct-mono">
                {{ t('app.home.mostUsed') }}
              </h2>
              <span class="section-rule" aria-hidden="true" />
            </div>
            <ol v-if="mostUsed.length" class="panel usage">
              <li v-for="item in mostUsed" :key="item.tool.id" class="usage-item">
                <RouterLink :to="`/tools/${item.tool.slug}`" class="usage-link">
                  <span class="usage-name">{{ item.tool.localizedTitle }}</span>
                  <span class="usage-count ct-mono" :title="t('app.home.opened', item.count)">{{ item.count }}</span>
                </RouterLink>
                <span class="usage-bar" aria-hidden="true">
                  <span class="usage-fill" :style="{ width: `${(item.count / topCount) * 100}%` }" />
                </span>
              </li>
            </ol>
            <p v-else class="panel empty">
              {{ t('app.home.mostUsedEmpty') }}
            </p>
          </section>

          <section class="panel session" aria-labelledby="home-session">
            <h2 id="home-session" class="section-label ct-mono">
              <span class="session-dot" aria-hidden="true" />
              {{ t('app.home.session') }}
            </h2>
            <dl class="session-stats">
              <div class="session-stat">
                <dt>{{ t('app.home.sessionOperations') }}</dt>
                <dd class="ct-mono">
                  {{ operations }}
                </dd>
              </div>
              <div class="session-stat">
                <dt>{{ t('app.home.sessionProcessed') }}</dt>
                <dd class="ct-mono">
                  {{ formatBytes(bytesProcessed) }}
                </dd>
              </div>
              <div class="session-stat">
                <dt>{{ t('app.home.sessionRequests') }}</dt>
                <dd class="ct-mono" :class="networkRequests ? 'session-warn' : 'session-ok'">
                  {{ networkRequests }}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <!-- Sans rail visible (tiroir), l'accueil reprend les catégories. -->
      <section class="home-categories" aria-labelledby="home-categories">
        <div class="section-head">
          <h2 id="home-categories" class="section-label ct-mono">
            {{ t('app.home.categories') }}
          </h2>
          <span class="section-rule" aria-hidden="true" />
        </div>
        <ul class="panel rows">
          <li v-for="category in categories" :key="category.id">
            <RouterLink :to="`/categories/${category.id}`" class="category-row">
              <component :is="category.icon" class="category-icon" aria-hidden="true" />
              <span class="category-label">{{ t(category.labelKey) }}</span>
              <span class="category-count ct-mono">{{ registry.countByCategory.get(category.id) ?? 0 }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-size: var(--ct-font-size-ui);
}

/* --- Barre de commande ------------------------------------------------------ */

.command {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  background: var(--ct-surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.command:focus-within {
  border-color: var(--ct-primary);
  box-shadow: 0 0 0 3px var(--ct-primary-faded);
}

.command-prompt {
  flex-shrink: 0;
  color: var(--ct-primary);
  font-size: 18px;
  font-weight: 600;
}

.command-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--ct-text);
  font-size: 14px;
  outline: none;
}

.command-input::placeholder {
  color: var(--ct-text-faint);
}

.command-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-left: 12px;
  border-left: 1px solid var(--ct-border);
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-secondary);
}

/* --- Sections ---------------------------------------------------------------- */

.section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-head .section-label {
  margin: 0;
}

.section-rule {
  flex: 1;
  height: 1px;
  background: var(--ct-border);
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ct-text-faint);
  font-size: 11px;
  cursor: pointer;
}

.link-button:hover {
  color: var(--ct-primary);
}

.panel {
  margin: 0;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  background: var(--ct-surface);
}

.rows {
  padding: 4px;
  list-style: none;
}

.empty {
  padding: 16px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-secondary);
  line-height: 1.5;
}

/* --- Tuiles de l'atelier --------------------------------------------------- */

.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  background: var(--ct-surface);
  color: var(--ct-text);
  text-decoration: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.tile:hover {
  border-color: var(--ct-border-strong);
  background: var(--ct-surface-raised);
}

.tile-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--ct-radius-control);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 18px;
}

.tile-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.tile-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tile-title {
  font-size: var(--ct-font-size-panel-title);
  font-weight: 600;
}

.tile-text {
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
  line-height: 1.4;
}

.tile-meta {
  color: var(--ct-text-faint);
  font-size: 11px;
}

/* --- Tableau de bord --------------------------------------------------------- */

.dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.usage {
  padding: 12px 16px;
  list-style: none;
}

.usage-item + .usage-item {
  margin-top: 12px;
}

.usage-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--ct-text);
  text-decoration: none;
}

.usage-link:hover .usage-name {
  color: var(--ct-primary);
}

.usage-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usage-count {
  flex-shrink: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.usage-bar {
  display: block;
  height: 3px;
  margin-top: 4px;
  border-radius: var(--ct-radius-pill);
  background: var(--ct-border);
  overflow: hidden;
}

.usage-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ct-primary);
}

.session {
  padding: 16px;
}

.session-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ct-primary);
}

.session-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 8px 0 0;
}

/* Le chiffre d'abord, à l'œil ; l'étiquette d'abord, dans le document. */
.session-stat {
  display: flex;
  flex-direction: column-reverse;
  /* En colonne inversée, `flex-end` est le haut : les chiffres restent alignés
     même quand une étiquette passe sur deux lignes. */
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}

.session-stat dt {
  color: var(--ct-text-faint);
  font-family: var(--ct-font-mono);
  font-size: var(--ct-font-size-label);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.session-stat dd {
  margin: 0;
  overflow: hidden;
  font-size: var(--ct-font-size-page-title);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-ok {
  color: var(--ct-primary);
}

.session-warn {
  color: var(--ct-warning);
}

/* --- Catégories, quand le rail est en tiroir ------------------------------ */

.home-categories {
  display: none;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--ct-radius-control);
  color: var(--ct-text);
  text-decoration: none;
}

.category-row:hover {
  background: var(--ct-elevated);
}

.category-icon {
  flex-shrink: 0;
  color: var(--ct-primary);
  font-size: 16px;
}

.category-label {
  flex: 1;
}

.category-count {
  color: var(--ct-text-faint);
  font-size: 11px;
}

@media (hover: none) {
  .category-row {
    min-height: 44px;
  }
}

@media (max-width: 1023.98px) {
  .dashboard {
    grid-template-columns: minmax(0, 1fr);
  }

  .home-categories {
    display: block;
  }
}

/* Téléphone : trois tuiles compactes, l'icône et le nom seulement. */
@media (max-width: 639.98px) {
  .home {
    gap: 16px;
  }

  .command {
    height: 48px;
  }

  .command-hint {
    display: none;
  }

  .tile {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .tile-text,
  .tile-meta {
    display: none;
  }

  .tile-title {
    font-size: var(--ct-font-size-ui);
  }
}
</style>
