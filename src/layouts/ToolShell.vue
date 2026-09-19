<script setup lang="ts">
import { type CategoryId, categoryById } from '~/catalog/categories';
import PathCrumb from '~/components/PathCrumb.vue';

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
}>(), {
  description: '',
  category: undefined,
  slug: undefined,
  wide: false,
});

const { t } = useI18n();
const category = computed(() => (props.category ? categoryById.get(props.category) : undefined));

const crumbs = computed(() => [
  ...(category.value ? [{ label: t(category.value.labelKey).toLowerCase(), to: `/categories/${category.value.id}` }] : []),
  ...(props.slug ? [{ label: props.slug }] : []),
]);
</script>

<template>
  <article class="tool">
    <header class="tool-header" :class="{ 'tool-header--wide': wide }">
      <PathCrumb :segments="crumbs" />

      <div class="title-row">
        <h1 class="title">
          {{ title }}
        </h1>
        <div class="actions">
          <slot name="actions" />
        </div>
      </div>

      <p v-if="description" class="description">
        {{ description }}
      </p>
    </header>

    <div class="tool-content" :class="{ 'tool-content--wide': wide }">
      <slot />
    </div>
  </article>
</template>

<style scoped>
/*
 * Même largeur que les cartes des outils (600 px) : l'en-tête et la première
 * carte partagent ainsi leur bord gauche, comme chez IT-Tools.
 */
.tool-header {
  max-width: 600px;
  margin: 0 auto 28px;
  padding-top: 8px;
}

.tool-header--wide {
  max-width: none;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.title {
  margin: 0;
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.description {
  margin: 10px 0 0;
  max-width: 68ch;
  color: var(--ct-text-muted);
  line-height: 1.55;
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
