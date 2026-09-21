<script setup lang="ts">
import { useShellCrumbs } from '~/app/shell';
import { type CategoryId, categoryById } from '~/catalog/categories';
import ToolContext from '~/components/ToolContext.vue';

/**
 * Cadre de la page d'un outil, identique quelle que soit la source.
 *
 * C'est l'un des endroits où se joue la promesse « l'utilisateur ne voit pas la
 * différence » : un outil d'IT-Tools et une opération de CyberChef arrivent tous
 * les deux ici, avec le même en-tête et la même grille.
 */
const props = withDefaults(defineProps<{
  title: string;
  description?: string;
  category?: CategoryId;
  /** Dernier segment du fil d'Ariane (`~/encodage/to-hex`). */
  slug?: string;
  /**
   * Par défaut, le contenu suit la grille d'IT-Tools : des cartes de 600 px au
   * plus, côte à côte quand la place le permet — leurs outils sont conçus pour.
   * `wide` lève cette contrainte (mode Recettes, éditeurs).
   */
  wide?: boolean;
  /**
   * Tout l'écran, sans la largeur de page : l'atelier et le Stego Lab sont des
   * espaces de travail, pas des pages à lire.
   */
  full?: boolean;
  /**
   * Espace de travail en panneaux (l'atelier) : toute la hauteur, sans marge,
   * et le titre réservé aux lecteurs d'écran — le fil d'Ariane le dit déjà.
   */
  workspace?: boolean;
}>(), {
  description: '',
  category: undefined,
  slug: undefined,
  wide: false,
  full: false,
  workspace: false,
});

const { t } = useI18n();
/** Le rail de contexte : pour une page d'outil, pas pour un espace de travail. */
const hasContext = computed(() => !props.full && Boolean(props.category && props.slug));
const category = computed(() => (props.category ? categoryById.get(props.category) : undefined));

// Le fil d'Ariane s'affiche dans la barre du haut du châssis.
useShellCrumbs(() => [
  ...(category.value ? [{ label: t(category.value.labelKey).toLowerCase(), to: `/categories/${category.value.id}` }] : []),
  ...(props.slug ? [{ label: props.slug }] : []),
]);
</script>

<template>
  <div class="tool-layout" :class="{ 'tool-layout--context': hasContext }">
    <article class="tool" :class="workspace ? 'tool--workspace' : full ? 'tool--full' : 'page'">
      <header class="tool-header" :class="{ 'tool-header--wide': wide, 'sr-only': workspace }">
        <h1 class="title">
          {{ title }}
        </h1>
        <p v-if="description" class="description">
          {{ description }}
        </p>
      </header>

      <div class="tool-content" :class="{ 'tool-content--wide': wide }">
        <slot />
      </div>
    </article>

    <ToolContext v-if="hasContext" class="tool-context-rail" :category="props.category!" :slug="props.slug!" />

    <!-- Les actions de l'outil vivent dans la barre du haut du châssis. -->
    <Teleport defer to="#ct-topbar-actions">
      <slot name="actions" />
    </Teleport>
  </div>
</template>

<style scoped>
/* Espace de travail : pas de largeur de page, seulement une marge. */
.tool--full {
  padding: 24px 24px 32px;
}

/* Espace en panneaux : le contenu gère lui-même sa hauteur et ses marges. */
.tool--workspace .tool-content {
  display: block;
}

@media (max-width: 639.98px) {
  .tool--full {
    padding: 20px 16px 32px;
  }
}

/*
 * Même largeur que les cartes des outils (600 px) : l'en-tête et la première
 * carte partagent ainsi leur bord gauche, comme chez IT-Tools.
 */
.tool-header {
  max-width: 600px;
  margin: 0 auto 24px;
}

.tool-header--wide {
  max-width: none;
}

/* 20 px au plus : un outil ouvert dix fois par jour n'a pas besoin d'un titre d'affiche. */
.title {
  margin: 0;
  font-size: var(--ct-font-size-page-title);
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.description {
  margin: 4px 0 0;
  max-width: 68ch;
  color: var(--ct-text-muted);
  font-size: var(--ct-font-size-ui);
  line-height: 1.5;
}

/*
 * Rail de contexte : à partir de 1280 px seulement. En dessous, il prendrait
 * la place de l'outil pour des raccourcis dont on se passe.
 */
.tool-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.tool-layout .tool-context-rail {
  display: none;
}

@media (min-width: 1280px) {
  .tool-layout--context {
    grid-template-columns: minmax(0, 1fr) 256px;
  }

  .tool-layout .tool-context-rail {
    display: flex;
    position: sticky;
    top: var(--ct-topbar-height);
    align-self: start;
    height: calc(100vh - var(--ct-topbar-height) - var(--ct-statusbar-height));
    overflow-y: auto;
    padding: 24px 16px;
    border-left: 1px solid var(--ct-border);
  }
}

/* Reprend la grille de tool.layout.vue d'IT-Tools, dont leurs outils dépendent. */
.tool-content {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
}

.tool-content > :deep(*) {
  flex: 0 1 600px;
  min-width: 0;
}

.tool-content--wide > :deep(*) {
  flex: 1 1 100%;
}
</style>
