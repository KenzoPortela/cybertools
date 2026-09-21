<script setup lang="ts">
/**
 * Fil d'Ariane écrit comme un chemin : `~/encodage/to-hex`. L'accueil est `~`,
 * chaque segment intermédiaire est un lien, le dernier est la page courante.
 */
import { RouterLink } from 'vue-router';

defineProps<{
  segments: { label: string; to?: string }[];
}>();

const { t } = useI18n();
</script>

<template>
  <nav class="crumb ct-mono" :aria-label="t('app.tool.breadcrumb')">
    <RouterLink to="/" class="home" :aria-label="t('app.nav.home')">~</RouterLink>
    <template v-for="(segment, index) in segments" :key="index">
      <span class="sep" aria-hidden="true">/</span>
      <RouterLink v-if="segment.to && index < segments.length - 1" :to="segment.to">
        {{ segment.label }}
      </RouterLink>
      <span v-else class="current" aria-current="page">{{ segment.label }}</span>
    </template>
  </nav>
</template>

<style scoped>
/* Dans la barre du haut : une seule ligne, qui se tronque plutôt que de déborder. */
.crumb {
  display: flex;
  align-items: baseline;
  gap: 0 2px;
  min-width: 0;
  overflow: hidden;
  font-size: var(--ct-font-size-data);
  white-space: nowrap;
  color: var(--ct-text-muted);
}

.crumb a {
  color: inherit;
  text-decoration: none;
}

.crumb a:hover {
  color: var(--ct-primary);
}

.home {
  font-weight: 700;
  color: var(--ct-primary) !important;
}

.sep {
  opacity: 0.5;
  padding: 0 2px;
}

.current {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ct-text);
}
</style>
