<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { paletteShortcutLabel } from '~/app/command-palette';
import { catalog } from '~/catalog/catalog';
import type { CategoryId } from '~/catalog/categories';
import { useRecentsStore } from '~/stores/recents';
import { useSessionStore } from '~/stores/session';

/**
 * Rail de contexte d'une page d'outil, à droite, en grand écran seulement :
 * rien ici n'est indispensable, tout est un raccourci.
 *
 *  - les autres outils de la catégorie, les plus ouverts d'abord ;
 *  - les raccourcis clavier qui existent vraiment ;
 *  - l'encart « hors ligne », avec la mesure de la barre d'état.
 */
const props = defineProps<{
  category: CategoryId;
  /** L'outil affiché, à ne pas proposer à lui-même. */
  slug: string;
}>();

const { t } = useI18n();
const recents = useRecentsStore();
const { networkRequests } = storeToRefs(useSessionStore());

const SIBLINGS = 8;

const inCategory = computed(() => catalog.inCategory(props.category));

/** Les plus ouverts d'abord ; le tri est stable, l'ordre alphabétique départage. */
const siblings = computed(() => {
  const counts = new Map(recents.entries.map(entry => [entry.id, entry.count]));
  return inCategory.value
    .filter(tool => tool.slug !== props.slug)
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    .slice(0, SIBLINGS);
});

const shortcuts = computed(() => [
  { keys: paletteShortcutLabel, label: t('app.context.shortcutSearch') },
  { keys: '/', label: t('app.context.shortcutSlash') },
  { keys: 'Esc', label: t('app.context.shortcutEscape') },
]);
</script>

<template>
  <aside class="tool-context" :aria-label="t('app.context.label')">
    <section v-if="siblings.length" aria-labelledby="context-category">
      <h2 id="context-category" class="context-label ct-mono">
        {{ t('app.context.category') }}
      </h2>
      <ul class="context-list">
        <li v-for="tool in siblings" :key="tool.id">
          <RouterLink :to="`/tools/${tool.slug}`" class="context-link">
            <span class="context-link-label">{{ tool.localizedTitle }}</span>
            <icon-mdi-chevron-right class="context-chevron" aria-hidden="true" />
          </RouterLink>
        </li>
      </ul>
      <RouterLink :to="`/categories/${category}`" class="context-more ct-mono">
        {{ t('app.context.all', inCategory.length) }}
      </RouterLink>
    </section>

    <section aria-labelledby="context-shortcuts">
      <h2 id="context-shortcuts" class="context-label ct-mono">
        {{ t('app.context.shortcuts') }}
      </h2>
      <dl class="shortcuts">
        <div v-for="shortcut in shortcuts" :key="shortcut.keys" class="shortcut">
          <dt><kbd>{{ shortcut.keys }}</kbd></dt>
          <dd>{{ shortcut.label }}</dd>
        </div>
      </dl>
    </section>

    <section class="offline" aria-labelledby="context-offline">
      <h2 id="context-offline" class="context-label ct-mono">
        <icon-mdi-lock-outline class="offline-icon" aria-hidden="true" />
        {{ t('app.context.offline') }}
      </h2>
      <p class="offline-text">
        {{ t('app.context.offlineText') }}
      </p>
      <p class="offline-count ct-mono">
        <span class="offline-dot" :class="{ 'offline-dot--warning': networkRequests }" aria-hidden="true" />
        {{ t('app.status.network', networkRequests) }}
      </p>
    </section>
  </aside>
</template>

<style scoped>
.tool-context {
  display: flex;
  flex-direction: column;
  gap: 24px;
  font-size: var(--ct-font-size-ui);
}

.context-label {
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

.context-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.context-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 8px;
  border-radius: var(--ct-radius-control);
  color: var(--ct-text-muted);
  text-decoration: none;
}

.context-link:hover {
  background: var(--ct-elevated);
  color: var(--ct-text);
}

.context-link-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-chevron {
  flex-shrink: 0;
  color: var(--ct-text-faint);
}

.context-more {
  display: inline-block;
  margin: 4px 8px 0;
  color: var(--ct-text-faint);
  font-size: 11px;
  text-decoration: none;
}

.context-more:hover {
  color: var(--ct-primary);
}

.shortcuts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.shortcut {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
  gap: 8px;
}

.shortcut dt {
  justify-self: start;
}

.shortcut dd {
  margin: 0;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
}

.offline {
  padding: 16px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  background: var(--ct-surface);
}

.offline-icon {
  color: var(--ct-primary);
  font-size: 14px;
}

.offline-text {
  margin: 0 0 12px;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-secondary);
  line-height: 1.5;
}

.offline-count {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
}

.offline-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ct-primary);
}

.offline-dot--warning {
  background: var(--ct-warning);
}

@media (hover: none) {
  .context-link {
    min-height: 44px;
  }
}
</style>
