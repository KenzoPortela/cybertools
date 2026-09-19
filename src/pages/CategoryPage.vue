<script setup lang="ts">
import { useHead } from '@vueuse/head';
import { useRoute } from 'vue-router';
import { catalog } from '~/catalog/catalog';
import { type CategoryId, categoryById } from '~/catalog/categories';
import PathCrumb from '~/components/PathCrumb.vue';
import ToolCard from '~/components/ToolCard.vue';
import NotFoundPage from '~/pages/NotFoundPage.vue';

const route = useRoute();
const { t } = useI18n();

const category = computed(() => categoryById.get(String(route.params.id) as CategoryId));
const tools = computed(() => (category.value ? catalog.inCategory(category.value.id) : []));

useHead(computed(() => ({ title: category.value ? t(category.value.labelKey) : undefined })));
</script>

<template>
  <NotFoundPage v-if="!category" />

  <section v-else>
    <PathCrumb :segments="[{ label: t(category.labelKey).toLowerCase() }]" />

    <header class="header">
      <span class="icon" aria-hidden="true">
        <component :is="category.icon" />
      </span>
      <div>
        <h1 class="title">
          {{ t(category.labelKey) }}
        </h1>
        <p class="count ct-mono">
          {{ t('app.category.count', tools.length) }}
        </p>
      </div>
    </header>

    <div v-if="tools.length" class="grid">
      <ToolCard v-for="tool in tools" :key="tool.id" :tool="tool" />
    </div>
    <p v-else class="empty">
      {{ t('app.category.empty') }}
    </p>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
}

.icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--ct-radius);
  border: 1px solid var(--ct-border);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 26px;
}

.title {
  margin: 0;
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.count {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ct-text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.empty {
  color: var(--ct-text-muted);
}
</style>
