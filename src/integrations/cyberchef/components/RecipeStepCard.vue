<script setup lang="ts">
/**
 * Une étape de recette : son opération, ses arguments, et de quoi la réordonner,
 * la désactiver ou la retirer. Les boutons monter / descendre doublent le
 * glisser-déposer, pour le clavier et les écrans tactiles.
 */
import { NButton, NTooltip } from 'naive-ui';
import CcArgsForm from '~/integrations/cyberchef/components/CcArgsForm.vue';
import type { OperationConfig } from '~/integrations/cyberchef/operations';
import type { WorkbenchStep } from '~/stores/recipe';

const props = defineProps<{
  step: WorkbenchStep;
  index: number;
  count: number;
  config?: OperationConfig;
  /** L'exécution de la recette a échoué à cette étape. */
  failed?: boolean;
}>();

const emit = defineEmits<{
  'update:args': [args: unknown[]];
  'toggle-disabled': [];
  'toggle-collapsed': [];
  'move': [delta: -1 | 1];
  'remove': [];
}>();

const { t } = useI18n();

const args = computed({
  get: () => props.step.args,
  set: value => emit('update:args', value),
});
</script>

<template>
  <section
    class="step"
    :class="{ 'step--disabled': step.disabled, 'step--failed': failed }"
    :aria-label="t('app.recipes.stepLabel', { index: index + 1, name: step.op })"
  >
    <header class="step-head">
      <span class="drag-handle" :title="t('app.recipes.drag')" aria-hidden="true">
        <icon-mdi-drag-vertical />
      </span>
      <span class="step-index">{{ index + 1 }}</span>
      <span class="step-name">{{ step.op }}</span>

      <div class="step-actions">
        <NTooltip :delay="400">
          <template #trigger>
            <NButton quaternary circle size="small" :aria-label="t('app.recipes.moveUp')" :disabled="index === 0" @click="emit('move', -1)">
              <icon-mdi-arrow-up />
            </NButton>
          </template>
          {{ t('app.recipes.moveUp') }}
        </NTooltip>
        <NTooltip :delay="400">
          <template #trigger>
            <NButton quaternary circle size="small" :aria-label="t('app.recipes.moveDown')" :disabled="index === count - 1" @click="emit('move', 1)">
              <icon-mdi-arrow-down />
            </NButton>
          </template>
          {{ t('app.recipes.moveDown') }}
        </NTooltip>
        <NTooltip :delay="400">
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              :aria-label="step.disabled ? t('app.recipes.enable') : t('app.recipes.disable')"
              :aria-pressed="step.disabled"
              @click="emit('toggle-disabled')"
            >
              <icon-mdi-eye-off-outline v-if="step.disabled" />
              <icon-mdi-eye-outline v-else />
            </NButton>
          </template>
          {{ step.disabled ? t('app.recipes.enable') : t('app.recipes.disable') }}
        </NTooltip>
        <NTooltip v-if="config?.args.length" :delay="400">
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              :aria-label="step.collapsed ? t('app.recipes.expand') : t('app.recipes.collapse')"
              :aria-expanded="!step.collapsed"
              @click="emit('toggle-collapsed')"
            >
              <icon-mdi-chevron-down v-if="step.collapsed" />
              <icon-mdi-chevron-up v-else />
            </NButton>
          </template>
          {{ step.collapsed ? t('app.recipes.expand') : t('app.recipes.collapse') }}
        </NTooltip>
        <NTooltip :delay="400">
          <template #trigger>
            <NButton quaternary circle size="small" :aria-label="t('app.recipes.remove')" @click="emit('remove')">
              <icon-mdi-close />
            </NButton>
          </template>
          {{ t('app.recipes.remove') }}
        </NTooltip>
      </div>
    </header>

    <div v-if="config && config.args.length && !step.collapsed" class="step-body">
      <CcArgsForm v-model:args="args" :config="config" />
    </div>
  </section>
</template>

<style scoped>
.step {
  border-radius: var(--ct-radius-large);
  border: 1px solid var(--ct-border);
  background: var(--ct-surface);
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.step--disabled {
  opacity: 0.55;
}

.step--disabled .step-name {
  text-decoration: line-through;
}

.step--failed {
  border-color: var(--ct-error);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ct-error) 18%, transparent);
}

.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 6px;
}

.drag-handle {
  display: grid;
  place-items: center;
  font-size: 20px;
  color: var(--ct-text-muted);
  cursor: grab;
  touch-action: none;
}

.step-index {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.step-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.step-body {
  padding: 4px 16px 16px;
  border-top: 1px solid var(--ct-border);
  padding-top: 14px;
}

@media (max-width: 480px) {
  .step-actions :deep(.n-button) {
    width: 30px;
  }
}
</style>
