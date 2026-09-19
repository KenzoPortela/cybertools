<script setup lang="ts">
import { NButton, NTooltip } from 'naive-ui';
import { useFavoritesStore } from '~/stores/favorites';

const props = withDefaults(defineProps<{
  toolId: string;
  size?: 'small' | 'medium';
}>(), { size: 'medium' });

const favorites = useFavoritesStore();
const { t } = useI18n();

const active = computed(() => favorites.isFavorite(props.toolId));
const label = computed(() => (active.value ? t('app.favorites.remove') : t('app.favorites.add')));

function toggle(event: Event) {
  // Le bouton vit souvent dans une carte-lien : on ne veut pas naviguer.
  event.preventDefault();
  event.stopPropagation();
  favorites.toggle(props.toolId);
}
</script>

<template>
  <NTooltip trigger="hover" :delay="400">
    <template #trigger>
      <NButton
        quaternary
        circle
        :size="size"
        :aria-label="label"
        :aria-pressed="active"
        class="favorite"
        :class="{ 'favorite--active': active }"
        @click="toggle"
      >
        <icon-mdi-star v-if="active" />
        <icon-mdi-star-outline v-else />
      </NButton>
    </template>
    {{ label }}
  </NTooltip>
</template>

<style scoped>
.favorite {
  color: var(--ct-text-muted);
  font-size: 18px;
}

.favorite--active {
  color: var(--ct-warning);
}
</style>
