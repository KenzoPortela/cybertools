<script setup lang="ts">
import { NModal } from 'naive-ui';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import IconMagic from '~icons/mdi/auto-fix';
import IconChefHat from '~icons/mdi/chef-hat';
import IconHistory from '~icons/mdi/history';
import IconHome from '~icons/mdi/home-outline';
import IconInfo from '~icons/mdi/information-outline';
import IconPlaylistPlus from '~icons/mdi/playlist-plus';
import IconSettings from '~icons/mdi/cog-outline';
import IconStar from '~icons/mdi/star-outline';
import IconTheme from '~icons/mdi/theme-light-dark';
import IconTranslate from '~icons/mdi/translate';
import { isMac, useCommandPalette } from '~/app/command-palette';
import { SUPPORTED_LOCALES } from '~/app/i18n';
import { useThemePreference } from '~/app/theme-preference';
import { catalog, normalizeForSearch } from '~/catalog/catalog';
import { categories, categoryById } from '~/catalog/categories';
import { registry } from '~/catalog/registry';
import type { LocalizedTool, RecipeStep } from '~/catalog/tool.types';
import { useFavoritesStore } from '~/stores/favorites';
import { useRecentsStore } from '~/stores/recents';
import { useRecipeStore } from '~/stores/recipe';

/**
 * Palette de commandes (Ctrl K / ⌘K, ou « / »).
 *
 * Portées, par préfixe ou par les puces sous le champ : rien pour tout
 * chercher, `/` pour les catégories, `#` pour la recette enregistrée, `>` pour
 * les commandes. Sur un outil, ⌘↵ l'ajoute à la recette en cours et ⌘F
 * l'épingle, sans quitter la palette pour l'épingle.
 */

type Scope = 'all' | 'category' | 'recipe' | 'command';
type GroupId = 'recents' | 'favorites' | 'commands' | 'best' | 'alsoKnown' | 'others' | 'actions' | 'categories' | 'recipes';

interface Item {
  key: string;
  label: string;
  /** Texte secondaire, en gris après le libellé : la description d'un outil. */
  description?: string;
  /** À droite : la catégorie d'un outil. */
  hint?: string;
  icon?: Component;
  /** Présent pour un outil : il peut s'ajouter à une recette ou s'épingler. */
  tool?: LocalizedTool;
  run: () => void;
}

interface Group {
  id: GroupId;
  items: Item[];
}

const { isOpen, close } = useCommandPalette();
const router = useRouter();
const favorites = useFavoritesStore();
const recents = useRecentsStore();
const recipes = useRecipeStore();
const { t, locale } = useI18n();
const { cycle: cycleTheme } = useThemePreference();

const query = ref('');
const activeIndex = ref(0);
const input = ref<HTMLInputElement>();
const list = ref<HTMLElement>();

const modKey = isMac ? '⌘' : 'Ctrl';

// --- Portées --------------------------------------------------------------------

const PREFIX: Record<Exclude<Scope, 'all'>, string> = { category: '/', recipe: '#', command: '>' };
const SCOPES: Scope[] = ['all', 'category', 'recipe', 'command'];

const scope = computed<Scope>(() => {
  const first = query.value.trimStart()[0];
  return (Object.keys(PREFIX) as Exclude<Scope, 'all'>[]).find(id => PREFIX[id] === first) ?? 'all';
});

/** Ce qui est cherché, sans le préfixe de portée. */
const term = computed(() => {
  const value = query.value.trimStart();
  return (scope.value === 'all' ? value : value.slice(1)).trim();
});

function setScope(next: Scope) {
  query.value = next === 'all' ? term.value : `${PREFIX[next]}${term.value}`;
  input.value?.focus();
}

// --- Outils : recette et épingle ----------------------------------------------

/** La recette qu'un outil ajoute à l'atelier, s'il est bâti sur CyberChef. */
function recipeOf(tool: LocalizedTool): RecipeStep[] | undefined {
  if (tool.renderer.kind === 'cc-op') return [{ op: tool.renderer.op, args: [] }];
  if (tool.renderer.kind === 'cc-recipe') return tool.renderer.recipe;
  if (tool.alsoAvailableAs?.kind === 'cc-recipe') return tool.alsoAvailableAs.recipe;
  return undefined;
}

/** ⌘↵ : ajouter à la recette en cours (la dernière), et ouvrir l'atelier. */
function addToRecipe(tool: LocalizedTool | undefined) {
  const recipe = tool && recipeOf(tool);
  if (!recipe) return;
  recipes.openWith(recipe, undefined, 'append');
  close();
  if (router.currentRoute.value.path !== '/tools/recipes') router.push('/tools/recipes');
}

/** ⌘F : épingler ou désépingler, en restant dans la palette. */
function togglePin(tool: LocalizedTool | undefined) {
  if (tool) favorites.toggle(tool.id);
}

function toolItem(tool: LocalizedTool, group: GroupId, withDescription = false): Item {
  return {
    key: `${group}:${tool.id}`,
    label: tool.localizedTitle,
    description: withDescription ? tool.localizedDescription : undefined,
    hint: tool.localizedCategory.toLowerCase(),
    icon: tool.icon ?? categoryById.get(tool.category)?.icon,
    tool,
    run: () => router.push(`/tools/${tool.slug}`),
  };
}

// --- Commandes ------------------------------------------------------------------

/** Commandes toujours proposées, y compris quand la recherche est vide. */
const coreCommands = computed<Item[]>(() => [
  { key: 'cmd:home', label: t('app.palette.commands.home'), icon: IconHome, run: () => router.push('/') },
  { key: 'cmd:recipes', label: t('app.palette.commands.recipes'), icon: IconChefHat, run: () => router.push('/tools/recipes') },
  { key: 'cmd:magic', label: t('app.palette.commands.magic'), icon: IconMagic, run: () => router.push('/tools/magic') },
  { key: 'cmd:theme', label: t('app.palette.commands.theme'), icon: IconTheme, run: cycleTheme },
  {
    key: 'cmd:locale',
    label: t('app.palette.commands.locale'),
    icon: IconTranslate,
    run: () => { locale.value = SUPPORTED_LOCALES.find(code => code !== locale.value) ?? 'fr'; },
  },
  { key: 'cmd:settings', label: t('app.palette.commands.settings'), icon: IconSettings, run: () => router.push('/settings') },
  { key: 'cmd:about', label: t('app.palette.commands.about'), icon: IconInfo, run: () => router.push('/about') },
]);

const categoryItems = computed<Item[]>(() => categories.map(category => ({
  key: `category:${category.id}`,
  label: t(category.labelKey),
  hint: t('app.category.count', registry.countByCategory.get(category.id) ?? 0),
  icon: category.icon,
  run: () => router.push(`/categories/${category.id}`),
})));

function contains(label: string, value: string) {
  return normalizeForSearch(label).includes(normalizeForSearch(value));
}

// --- Meilleurs résultats et « aussi appelés » ------------------------------------

const FILLER = new Set(['to', 'from', 'the', 'of', 'a', 'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'en', 'et']);

/** Distance d'édition, transpositions comprises : « caeser » est à 1 de « caesar ». */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array.from({ length: b.length }, () => 0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function tokensOf(value: string) {
  return normalizeForSearch(value).split(/[^a-z0-9]+/).filter(word => word.length > 1 && !FILLER.has(word));
}

/** Tous les mots tapés se retrouvent dans ces textes, à une faute près. */
function covers(texts: readonly string[], value: string) {
  const tokens = tokensOf(value);
  if (!tokens.length) return true;
  const words = texts.flatMap(text => normalizeForSearch(text).split(/[^a-z0-9]+/).filter(Boolean));
  return tokens.every(token => words.some(word => word.startsWith(token) || (token.length >= 4 && distance(token, word) <= 1)));
}

/**
 * Le moteur de recherche classe, sans dire pourquoi. On range ensuite :
 *  - le nom de l'outil porte les mots tapés : meilleur résultat ;
 *  - ses mots-clés les portent (synonymes, nom courant) : il est « aussi
 *    appelé » ainsi, comme ROT13 pour « caesar » ;
 *  - sinon, il a été retenu de plus loin (description, faute de frappe
 *    rapprochée d'un autre mot) : autre résultat.
 */
function namedAfter(tool: LocalizedTool, value: string) {
  return covers([tool.localizedTitle, tool.title.fallback], value);
}

function knownAs(tool: LocalizedTool, value: string) {
  return covers(tool.keywords, value);
}

// --- Groupes ----------------------------------------------------------------------

const groups = computed<Group[]>(() => {
  const value = term.value;
  let result: Group[];

  if (scope.value === 'category') {
    result = [{ id: 'categories', items: categoryItems.value.filter(item => !value || contains(item.label, value)) }];
  }
  else if (scope.value === 'command') {
    result = [{ id: 'commands', items: coreCommands.value.filter(item => !value || contains(item.label, value)) }];
  }
  else if (scope.value === 'recipe') {
    const saved = recipes.saved;
    const matches = saved.length > 0 && (!value || saved.some(step => contains(step.op, value)));
    result = [{
      id: 'recipes',
      items: matches
        ? [{
            key: 'recipe:last',
            label: t('app.palette.resumeRecipe'),
            description: saved.map(step => step.op).join(' › '),
            hint: t('app.recipes.stepCount', saved.length),
            icon: IconHistory,
            run: () => {
              recipes.openWith(saved);
              if (router.currentRoute.value.path !== '/tools/recipes') router.push('/tools/recipes');
            },
          }]
        : [],
    }];
  }
  else if (!value) {
    result = [
      { id: 'recents', items: recents.tools.slice(0, 5).map(tool => toolItem(tool, 'recents')) },
      { id: 'favorites', items: favorites.tools.map(tool => toolItem(tool, 'favorites')) },
      { id: 'commands', items: coreCommands.value },
    ];
  }
  else {
    const found = catalog.search(value, 30);
    const best = found.filter(tool => namedAfter(tool, value));
    const alsoKnown = found.filter(tool => !namedAfter(tool, value) && knownAs(tool, value));
    const others = found.filter(tool => !namedAfter(tool, value) && !knownAs(tool, value));
    const top = found[0];
    const actions: Item[] = [];
    if (top && recipeOf(top)) {
      actions.push({ key: `action:add:${top.id}`, label: t('app.palette.addToRecipe', { name: top.localizedTitle }), hint: t('app.palette.workbench'), icon: IconPlaylistPlus, run: () => addToRecipe(top) });
    }
    if (top) {
      const pinned = favorites.isFavorite(top.id);
      actions.push({ key: `action:pin:${top.id}`, label: t(pinned ? 'app.palette.unpin' : 'app.palette.pin', { name: top.localizedTitle }), icon: IconStar, run: () => togglePin(top) });
    }
    // Les commandes passent devant les outils : elles ne s'affichent que si leur
    // libellé contient la saisie telle quelle, un signal bien plus sûr qu'une
    // correspondance floue (« paramètres » doit ouvrir les paramètres, pas un
    // outil dont la description parle de « parameters »).
    result = [
      { id: 'commands', items: [...coreCommands.value, ...categoryItems.value].filter(item => contains(item.label, value)) },
      { id: 'best', items: best.map(tool => toolItem(tool, 'best', true)) },
      { id: 'alsoKnown', items: alsoKnown.map(tool => toolItem(tool, 'alsoKnown', true)) },
      { id: 'others', items: others.map(tool => toolItem(tool, 'others', true)) },
      { id: 'actions', items: actions },
    ];
  }

  return result.filter(group => group.items.length > 0);
});

const flatItems = computed(() => groups.value.flatMap(group => group.items));
const activeItem = computed(() => flatItems.value[activeIndex.value]);

/** Position d'un élément dans la liste aplatie, pour la navigation au clavier. */
function indexOf(item: Item) {
  return flatItems.value.indexOf(item);
}

watch(query, () => {
  activeIndex.value = 0;
});

watch(isOpen, async (open) => {
  if (!open) return;
  query.value = '';
  activeIndex.value = 0;
  await nextTick();
  input.value?.focus();
});

watch(activeIndex, async (index) => {
  await nextTick();
  list.value?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
});

function run(item: Item | undefined) {
  if (!item) return;
  // Épingler garde la palette ouverte : on voit l'étoile changer.
  if (item.key.startsWith('action:pin:')) {
    item.run();
    return;
  }
  close();
  item.run();
}

function onKeydown(event: KeyboardEvent) {
  const count = flatItems.value.length;
  const modifier = event.ctrlKey || event.metaKey;

  if (modifier && event.key === 'Enter') {
    event.preventDefault();
    addToRecipe(activeItem.value?.tool);
    return;
  }
  if (modifier && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    togglePin(activeItem.value?.tool);
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (count) activeIndex.value = (activeIndex.value + 1) % count;
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (count) activeIndex.value = (activeIndex.value - 1 + count) % count;
      break;
    case 'Home':
      if (query.value === '') {
        event.preventDefault();
        activeIndex.value = 0;
      }
      break;
    case 'End':
      if (query.value === '') {
        event.preventDefault();
        activeIndex.value = Math.max(count - 1, 0);
      }
      break;
    case 'Enter':
      event.preventDefault();
      run(activeItem.value);
      break;
    case 'Escape':
      event.preventDefault();
      close();
      break;
  }
}

const emptyMessage = computed(() => {
  if (scope.value === 'recipe' && !recipes.saved.length) return t('app.palette.noRecipe');
  return term.value ? t('app.palette.empty', { query: term.value }) : t('app.palette.emptyScope');
});
</script>

<template>
  <NModal
    :show="isOpen"
    :auto-focus="false"
    transform-origin="center"
    @update:show="(value: boolean) => { if (!value) close(); }"
  >
    <div
      class="palette"
      role="dialog"
      aria-modal="true"
      :aria-label="t('app.palette.label')"
    >
      <div class="search">
        <span class="search-prompt ct-mono" aria-hidden="true">›</span>
        <input
          ref="input"
          v-model="query"
          class="search-input ct-mono"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="palette-list"
          :aria-expanded="flatItems.length > 0"
          :aria-activedescendant="flatItems.length ? `palette-item-${activeIndex}` : undefined"
          :placeholder="t('app.palette.placeholder')"
          autocomplete="off"
          spellcheck="false"
          @keydown="onKeydown"
        >
        <span v-if="term" class="search-count ct-mono">{{ t('app.palette.resultCount', flatItems.length) }}</span>
        <kbd class="esc">Esc</kbd>
      </div>

      <div class="scopes">
        <span class="scopes-label ct-mono">{{ t('app.palette.scopes.label') }}</span>
        <button
          v-for="id in SCOPES"
          :key="id"
          type="button"
          class="scope ct-mono"
          :class="{ 'scope--active': scope === id }"
          :aria-pressed="scope === id"
          @click="setScope(id)"
        >
          <span v-if="id !== 'all'" class="scope-prefix" aria-hidden="true">{{ PREFIX[id] }}</span>{{ t(`app.palette.scopes.${id}`) }}
        </button>
        <span class="scopes-note ct-mono">{{ t('app.palette.tolerant') }}</span>
      </div>

      <div id="palette-list" ref="list" class="list" role="listbox" :aria-label="t('app.palette.label')">
        <div v-for="group in groups" :key="group.id" role="group" :aria-labelledby="`palette-group-${group.id}`">
          <div :id="`palette-group-${group.id}`" class="group-title ct-mono">
            <span>{{ t(`app.palette.groups.${group.id}`) }}</span>
            <span>{{ group.items.length }}</span>
          </div>
          <div
            v-for="item in group.items"
            :id="`palette-item-${indexOf(item)}`"
            :key="item.key"
            :data-index="indexOf(item)"
            class="item"
            :class="{ 'item--active': indexOf(item) === activeIndex }"
            role="option"
            :aria-selected="indexOf(item) === activeIndex"
            @mousemove="activeIndex = indexOf(item)"
            @click="run(item)"
          >
            <span class="item-icon" aria-hidden="true">
              <component :is="item.icon" v-if="item.icon" />
            </span>
            <span class="item-label">{{ item.label }}</span>
            <span v-if="item.description" class="item-description">{{ item.description }}</span>
            <icon-mdi-star v-if="item.tool && favorites.isFavorite(item.tool.id)" class="item-pinned" :aria-label="t('app.palette.pinned')" />
            <span v-if="item.hint" class="item-hint ct-mono">{{ item.hint }}</span>
            <kbd v-if="indexOf(item) === activeIndex" class="item-enter" aria-hidden="true">↵</kbd>
          </div>
        </div>

        <p v-if="!flatItems.length" class="empty">
          {{ emptyMessage }}
        </p>
      </div>

      <footer class="footer" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> {{ t('app.palette.hints.navigate') }}</span>
        <span><kbd>↵</kbd> {{ t('app.palette.hints.open') }}</span>
        <span :class="{ 'footer-off': !activeItem?.tool || !recipeOf(activeItem.tool) }"><kbd>{{ modKey }} ↵</kbd> {{ t('app.palette.hints.add') }}</span>
        <span :class="{ 'footer-off': !activeItem?.tool }"><kbd>{{ modKey }} F</kbd> {{ t('app.palette.hints.pin') }}</span>
        <span class="footer-count ct-mono">{{ t('app.status.indexed', registry.tools.length) }}</span>
      </footer>
    </div>
  </NModal>
</template>

<style scoped>
.palette {
  width: min(720px, calc(100vw - 24px));
  /* Placée haut dans la page, comme une barre de recherche, pas centrée. */
  margin: max(8vh, 12px) auto auto;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  max-height: min(600px, calc(100vh - 16vh));
  border-radius: var(--ct-radius-float);
  background: var(--ct-surface);
  border: 1px solid var(--ct-border-strong);
  box-shadow: 0 24px 64px rgb(0 0 0 / 28%);
  overflow: hidden;
  color: var(--ct-text);
  font-size: var(--ct-font-size-ui);
}

.search {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--ct-border);
}

.search-prompt {
  flex-shrink: 0;
  color: var(--ct-primary);
  font-size: 18px;
  font-weight: 600;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 52px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 15px;
}

.search-input::placeholder {
  color: var(--ct-text-faint);
}

.search-count {
  flex-shrink: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
}

/* --- Portées --------------------------------------------------------------- */

.scopes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ct-border);
}

.scopes-label {
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.scope {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-control);
  background: transparent;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
  cursor: pointer;
}

.scope:hover {
  border-color: var(--ct-border-strong);
  color: var(--ct-text);
}

.scope-prefix {
  margin-right: 4px;
  color: var(--ct-text-faint);
}

.scope--active {
  border-color: transparent;
  background: var(--ct-primary-faded);
  color: var(--ct-text);
}

.scopes-note {
  margin-left: auto;
  color: var(--ct-text-faint);
  font-size: 11px;
}

/* --- Résultats ------------------------------------------------------------ */

.list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
  overscroll-behavior: contain;
}

.group-title {
  display: flex;
  justify-content: space-between;
  padding: 12px 8px 4px;
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-label);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding: 0 8px;
  border-radius: var(--ct-radius-control);
  cursor: pointer;
}

.item--active {
  background: var(--ct-primary-faded);
  box-shadow: inset 2px 0 0 var(--ct-primary);
}

.item-icon {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--ct-radius-micro);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
}

.item-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.item-label {
  flex-shrink: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-description {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-pinned {
  flex-shrink: 0;
  color: var(--ct-warning);
}

.item-hint {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--ct-text-faint);
  font-size: 11px;
}

.item-description + .item-pinned,
.item-description + .item-hint {
  margin-left: 0;
}

.item-enter {
  flex-shrink: 0;
}

.empty {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: var(--ct-text-muted);
}

/* --- Pied : les raccourcis --------------------------------------------------- */

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--ct-border);
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
}

/* Raccourci sans effet sur l'élément actif : visible, mais en retrait. */
.footer-off {
  opacity: 0.45;
}

.footer-count {
  margin-left: auto;
  color: var(--ct-text-faint);
  font-size: 11px;
}

kbd {
  display: inline-block;
  min-width: 20px;
  padding: 1px 5px;
  margin-right: 2px;
  border-radius: var(--ct-radius-micro);
  border: 1px solid var(--ct-border);
  background: var(--ct-background);
  font-size: 11px;
  font-family: var(--ct-font-mono);
  text-align: center;
}

.esc {
  flex-shrink: 0;
}

@media (hover: none) {
  .item {
    min-height: 44px;
  }

  .scope {
    height: 44px;
  }
}

@media (max-width: 640px) {
  .footer,
  .scopes-note,
  .item-description,
  .item-hint,
  .item-enter {
    display: none;
  }

  .item-label {
    max-width: none;
  }
}
</style>
