<!--
  Surcharge de vendor/it-tools/src/ui/c-table/c-table.vue
  @upstream-sha256 21e7e7cd0c1224a36b0f78e2afe30c0f5308828f71e9e0dd806bf118978950ac

  Le script et la structure du tableau sont repris à l'identique. Seules les
  couleurs changent : l'original les code en dur dans son template (#333333,
  #232323, gray-500…), des gris neutres qui tranchent avec nos surfaces. Elles
  passent ici par nos variables --ct-*, dans un bloc de style local.

  L'import de types est réécrit en `@/` : un chemin relatif partirait d'ici.
-->
<script lang="ts" setup>
import _ from 'lodash';
import type { HeaderConfiguration } from '@/ui/c-table/c-table.types';

const props = withDefaults(defineProps<{ data?: Record<string, unknown>[]; headers?: HeaderConfiguration ; hideHeaders?: boolean; description?: string }>(), { data: () => [], headers: undefined, hideHeaders: false, description: 'Data table' });
const { data, headers: rawHeaders, hideHeaders } = toRefs(props);

const headers = computed(() => {
  if (rawHeaders.value) {
    if (Array.isArray(rawHeaders.value)) {
      return rawHeaders.value.map((value) => {
        if (typeof value === 'string') {
          return { key: value, label: value };
        }

        const { key, label } = value;

        return {
          key,
          label: label ?? key,
        };
      });
    }

    return _.map(rawHeaders.value, (value, key) => ({
      key, label: value,
    }));
  }

  return _.chain(data.value)
    .map(row => Object.keys(row))
    .flatten()
    .uniq()
    .map(key => ({ key, label: key }))
    .value();
});
</script>

<template>
  <div class="relative overflow-x-auto rounded">
    <table class="ct-table w-full border-collapse text-left text-sm" role="table" :aria-label="description">
      <thead v-if="!hideHeaders" class="ct-table-head uppercase">
        <tr>
          <th v-for="header in headers" :key="header.key" scope="col" class="px-6 py-3 text-xs">
            {{ header.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, i) in data" :key="i" class="ct-table-row"
          :class="{
            'ct-table-row--last': i === data.length - 1,
          }"
        >
          <td v-for="header in headers" :key="header.key" class="px-6 py-4">
            <slot :name="header.key" :row="row" :headers="headers" :value="row[header.key]">
              {{ row[header.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ct-table {
  color: var(--ct-text-muted);
}

.ct-table-head {
  background: var(--ct-elevated);
  color: var(--ct-text);
  border-bottom: 1px solid var(--ct-border);
}

.ct-table-row {
  background: var(--ct-surface);
  border-bottom: 1px solid var(--ct-border);
}

.ct-table-row--last {
  border-bottom: none;
}
</style>
