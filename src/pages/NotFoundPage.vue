<script setup lang="ts">
import { NButton } from 'naive-ui';
import { RouterLink } from 'vue-router';

const { t } = useI18n();
</script>

<template>
  <section text-center py-20>
    <h1 class="code" op-40>
      404
    </h1>
    <p mb-6 op-70>
      {{ t('app.notFound.message') }}
    </p>
    <RouterLink to="/">
      <NButton type="primary">
        {{ t('app.notFound.backHome') }}
      </NButton>
    </RouterLink>
  </section>
</template>

<style scoped>
.code {
  font-size: 72px;
  font-weight: 700;
  margin: 0 0 8px;
  line-height: 1;
}
</style>
