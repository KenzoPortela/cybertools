<script setup lang="ts">
import { useHead } from '@vueuse/head';
import { NAlert } from 'naive-ui';
import { type Component, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { type StatusItem, useShellStatus } from '~/app/shell';
import { catalog } from '~/catalog/catalog';
import type { LocalizedTool, ToolSource } from '~/catalog/tool.types';
import FavoriteButton from '~/components/FavoriteButton.vue';
import { ToolLoadError, ToolLoading } from '~/components/tool-states';
import { formatBytes } from '~/integrations/cyberchef/output';
import ToolShell from '~/layouts/ToolShell.vue';
import NotFoundPage from '~/pages/NotFoundPage.vue';
import { useRecentsStore } from '~/stores/recents';
import { useRecipeStore } from '~/stores/recipe';
import { useSessionStore } from '~/stores/session';

/**
 * Page d'un outil, quelle que soit sa source. Elle ne connaît que le
 * ToolRenderer : un composant Vue (IT-Tools) ou, plus tard, une opération ou une
 * recette CyberChef.
 */

// Un composant asynchrone par outil, créé une fois : le recréer à chaque visite
// ferait perdre le cache du chargeur et provoquerait un remontage inutile.
const asyncComponents = new Map<string, Component>();

// Le moteur de formulaire CyberChef n'est chargé qu'à l'ouverture d'une opération.
const CyberChefOperation = defineAsyncComponent({
  loader: () => import('~/integrations/cyberchef/components/CyberChefOperation.vue'),
  loadingComponent: ToolLoading,
  errorComponent: ToolLoadError,
  delay: 200,
});

function componentFor(tool: LocalizedTool): Component | undefined {
  if (tool.renderer.kind !== 'vue') return undefined;

  let component = asyncComponents.get(tool.id);
  if (!component) {
    component = defineAsyncComponent({
      loader: tool.renderer.component,
      loadingComponent: ToolLoading,
      errorComponent: ToolLoadError,
      // Pas d'indicateur pour un chargement quasi instantané : il clignoterait.
      delay: 200,
      timeout: 30_000,
    });
    asyncComponents.set(tool.id, component);
  }
  return component;
}

const route = useRoute();
const { t, locale } = useI18n();
const recents = useRecentsStore();
const router = useRouter();
const recipes = useRecipeStore();

/**
 * Outil IT-Tools doublé d'un équivalent CyberChef : on propose de l'ouvrir dans
 * l'atelier, où il pourra s'enchaîner avec d'autres opérations.
 */
function openInRecipes() {
  const equivalent = tool.value?.alsoAvailableAs;
  if (equivalent?.kind !== 'cc-recipe') return;
  recipes.openWith(equivalent.recipe);
  router.push('/tools/recipes');
}

/** L'outil du slug demandé, anciens slugs compris. */
const tool = computed(() => catalog.toolForSlug(String(route.params.slug)));
const component = computed(() => (tool.value ? componentFor(tool.value) : undefined));

watch(() => tool.value?.id, (id) => {
  if (id) recents.record(id);
}, { immediate: true });

// --- Barre d'état ------------------------------------------------------------

const SOURCE_NAMES: Record<ToolSource, string> = { 'it-tools': 'IT-Tools', 'cyberchef': 'CyberChef', 'native': 'cybertools' };

const session = useSessionStore();

/** Ouverture de l'outil : seules les exécutions postérieures sont les siennes. */
const openedAt = ref(performance.now());
watch(() => tool.value?.id, () => {
  openedAt.value = performance.now();
});

function formatDuration(ms: number) {
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: ms < 10 ? 1 : 0 }).format(ms);
}

/**
 * D'où vient l'outil, et ce qu'il vient de calculer. Seuls les outils bâtis sur
 * le moteur CyberChef ont une dernière exécution à montrer ; un outil introuvable
 * laisse la barre à la session.
 */
useShellStatus(() => {
  if (!tool.value) return null;
  const items: StatusItem[] = [{ text: t('app.status.source', { source: SOURCE_NAMES[tool.value.source] }) }];
  const bake = session.lastBake;
  if (bake && bake.at >= openedAt.value) {
    const summary = t('app.status.bake', {
      input: formatBytes(bake.inputBytes),
      output: formatBytes(bake.outputBytes),
      duration: formatDuration(bake.duration),
      operations: t('app.status.operations', bake.operations),
    });
    items.push({
      text: bake.failed ? `${summary} · ${t('app.status.failed')}` : summary,
      tone: bake.failed ? 'error' : 'success',
    });
  }
  return items;
});

useHead(computed(() => ({
  title: tool.value?.localizedTitle,
  meta: [{ name: 'description', content: tool.value?.localizedDescription ?? '' }],
})));
</script>

<template>
  <NotFoundPage v-if="!tool" />

  <ToolShell
    v-else
    :title="tool.localizedTitle"
    :description="tool.localizedDescription"
    :category="tool.category"
    :slug="tool.slug"
    :wide="tool.renderer.kind !== 'vue' || tool.layout !== undefined"
    :full="tool.layout === 'full'"
  >
    <template #actions>
      <c-button
        v-if="tool.alsoAvailableAs?.kind === 'cc-recipe'"
        size="small"
        class="recipes-link"
        :aria-label="t('app.recipes.openIn')"
        @click="openInRecipes"
      >
        <icon-mdi-chef-hat class="recipes-link-icon" aria-hidden="true" />
        <span class="recipes-link-label">{{ t('app.recipes.openIn') }}</span>
      </c-button>
      <FavoriteButton :tool-id="tool.id" />
    </template>

    <NAlert v-if="tool.unavailable" type="warning" :title="t('app.tool.unavailable')">
      {{ tool.unavailable }}
    </NAlert>

    <component :is="component" v-if="component" :key="tool.id" />
    <CyberChefOperation
      v-else-if="tool.renderer.kind === 'cc-op'"
      :key="tool.id"
      :op="tool.renderer.op"
      :slug="tool.slug"
    />
    <p v-else class="pending">
      {{ t('app.tool.comingSoon') }}
    </p>
  </ToolShell>
</template>

<style scoped>
.recipes-link {
  align-self: center;
}

.recipes-link-icon {
  margin-right: 6px;
}

@media (max-width: 640px) {
  .recipes-link-label {
    display: none;
  }

  .recipes-link-icon {
    margin-right: 0;
  }
}

.pending {
  color: var(--ct-text-muted);
  text-align: center;
}
</style>

<style>
/* Non scopé : ces états sont rendus par defineAsyncComponent, hors de ce composant. */
.tool-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--ct-text-muted);
  text-align: center;
}

.tool-state-detail {
  font-size: 12px;
  max-width: 100%;
  overflow-wrap: anywhere;
}
</style>
