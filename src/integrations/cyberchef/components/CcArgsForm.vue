<script setup lang="ts">
/**
 * Formulaire des arguments d'une opération, dérivé de sa configuration. Sert à
 * la page d'une opération comme à chaque étape d'une recette.
 */
import CcArgField from '~/integrations/cyberchef/components/CcArgField.vue';
import { type OperationConfig, applyPopulate, disabledArgs } from '~/integrations/cyberchef/operations';

const props = defineProps<{
  config: OperationConfig;
  /** Étape de recette : deux colonnes serrées, libellés en étiquettes. */
  compact?: boolean;
}>();
const args = defineModel<unknown[]>('args', { required: true });

const disabled = computed(() => disabledArgs(props.config, args.value));

function setArg(index: number, value: unknown) {
  const values = [...args.value];
  values[index] = value;
  args.value = values;
}

function onPopulate(target: number | number[], value: unknown) {
  const values = [...args.value];
  applyPopulate(values, target, value);
  args.value = values;
}
</script>

<template>
  <div class="params-grid" :class="{ 'params-grid--compact': compact }">
    <CcArgField
      v-for="(arg, index) in config.args"
      :key="index"
      :arg="arg"
      :value="args[index]"
      :disabled="disabled.has(index)"
      :compact="compact"
      @update:value="(value: unknown) => setArg(index, value)"
      @populate="onPopulate"
    />
  </div>
</template>

<style scoped>
.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

/* Deux colonnes, même dans un panneau étroit : la recette se lit d'un coup d'œil. */
.params-grid--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}
</style>
