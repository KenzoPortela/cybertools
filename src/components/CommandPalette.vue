<script setup lang="ts">
import { NModal } from 'naive-ui';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import IconMagic from '~icons/mdi/auto-fix';
import IconCategory from '~icons/mdi/shape-outline';
import IconChefHat from '~icons/mdi/chef-hat';
import IconHome from '~icons/mdi/home-outline';
import IconInfo from '~icons/mdi/information-outline';
import IconSettings from '~icons/mdi/cog-outline';
import IconTheme from '~icons/mdi/theme-light-dark';
import IconTranslate from '~icons/mdi/translate';
import { useCommandPalette } from '~/app/command-palette';
import { SUPPORTED_LOCALES } from '~/app/i18n';
import { useThemePreference } from '~/app/theme-preference';
import { catalog, normalizeForSearch } from '~/catalog/catalog';
import { categories } from '~/catalog/categories';
import type { LocalizedTool } from '~/catalog/tool.types';
import { useFavoritesStore } from '~/stores/favorites';
import { useRecentsStore } from '~/stores/recents';

type GroupId = 'recents' | 'favorites' | 'tools' | 'commands';

interface Item {
  key: string;
  label: string;
  hint?: string;
  icon?: Component;
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
const { t, locale } = useI18n();
const { cycle: cycleTheme } = useThemePreference();

const query = ref('');
const activeIndex = ref(0);
const input = ref<HTMLInputElement>();
const list = ref<HTMLElement>();

function toolItem(tool: LocalizedTool, group: GroupId): Item {
  return {
    key: `${group}:${tool.id}`,
    label: tool.localizedTitle,
    hint: tool.localizedCategory,
    icon: tool.icon,
    run: () => router.push(`/tools/${tool.slug}`),
  };
}

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

/**
 * Les dix catégories n'apparaissent qu'à la recherche : affichées d'office, elles
 * noieraient les récents et les favoris.
 */
const categoryCommands = computed<Item[]>(() => categories.map(category => ({
  key: `cmd:category:${category.id}`,
  label: t('app.palette.commands.category', { name: t(category.labelKey) }),
  icon: IconCategory,
  run: () => router.push(`/categories/${category.id}`),
})));

const groups = computed<Group[]>(() => {
  const trimmed = query.value.trim();

  // Les commandes passent devant les outils : elles ne s'affichent que si leur
  // libellé contient la saisie telle quelle, un signal bien plus sûr qu'une
  // correspondance floue (« paramètres » doit ouvrir les paramètres, pas un
  // outil dont la description parle de « parameters »).
  const result: Group[] = trimmed
    ? [
        {
          id: 'commands',
          items: [...coreCommands.value, ...categoryCommands.value]
            .filter(command => normalizeForSearch(command.label).includes(normalizeForSearch(trimmed))),
        },
        { id: 'tools', items: catalog.search(trimmed, 30).map(tool => toolItem(tool, 'tools')) },
      ]
    : [
        { id: 'recents', items: recents.tools.slice(0, 5).map(tool => toolItem(tool, 'recents')) },
        { id: 'favorites', items: favorites.tools.map(tool => toolItem(tool, 'favorites')) },
        { id: 'commands', items: coreCommands.value },
      ];

  return result.filter(group => group.items.length > 0);
});

const flatItems = computed(() => groups.value.flatMap(group => group.items));

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
  close();
  item.run();
}

function onKeydown(event: KeyboardEvent) {
  const count = flatItems.value.length;

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
      run(flatItems.value[activeIndex.value]);
      break;
    case 'Escape':
      event.preventDefault();
      close();
      break;
  }
}
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
        <icon-mdi-magnify class="search-icon" aria-hidden="true" />
        <input
          ref="input"
          v-model="query"
          class="search-input"
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
        <kbd class="esc">Esc</kbd>
      </div>

      <div id="palette-list" ref="list" class="list" role="listbox">
        <template v-for="group in groups" :key="group.id">
          <div class="group-title" role="presentation">
            {{ t(`app.palette.groups.${group.id}`) }}
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
            <span v-if="item.hint" class="item-hint">{{ item.hint }}</span>
          </div>
        </template>

        <p v-if="!flatItems.length" class="empty">
          {{ t('app.palette.empty', { query: query.trim() }) }}
        </p>
      </div>

      <footer class="footer" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd> {{ t('app.palette.hints.navigate') }}</span>
        <span><kbd>↵</kbd> {{ t('app.palette.hints.open') }}</span>
        <span><kbd>Esc</kbd> {{ t('app.palette.hints.close') }}</span>
      </footer>
    </div>
  </NModal>
</template>

<style scoped>
.palette {
  width: min(640px, calc(100vw - 24px));
  /* Placée haut dans la page, comme une barre de recherche, pas centrée. */
  margin: max(8vh, 12px) auto auto;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  max-height: min(560px, calc(100vh - 16vh));
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
  border: 1px solid var(--ct-border);
  box-shadow: 0 24px 64px rgb(0 0 0 / 28%);
  overflow: hidden;
  color: var(--ct-text);
}

.search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border-bottom: 1px solid var(--ct-border);
}

.search-icon {
  font-size: 20px;
  color: var(--ct-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 54px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 16px;
}

.search-input::placeholder {
  color: var(--ct-text-muted);
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  overscroll-behavior: contain;
}

.group-title {
  padding: 10px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ct-text-muted);
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--ct-radius-medium);
  cursor: pointer;
}

.item--active {
  background: var(--ct-primary-faded);
}

.item-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--ct-radius);
  background: var(--ct-neutral);
  color: var(--ct-text-muted);
}

.item--active .item-icon {
  color: var(--ct-primary);
}

.item-icon :deep(svg) {
  width: 17px;
  height: 17px;
}

.item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-hint {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}

.empty {
  margin: 0;
  padding: 28px 12px;
  text-align: center;
  color: var(--ct-text-muted);
}

.footer {
  display: flex;
  gap: 16px;
  padding: 9px 14px;
  border-top: 1px solid var(--ct-border);
  font-size: 12px;
  color: var(--ct-text-muted);
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

@media (max-width: 640px) {
  .footer {
    display: none;
  }

  .item-hint {
    display: none;
  }
}
</style>
