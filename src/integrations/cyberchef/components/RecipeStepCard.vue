<script setup lang="ts">
/**
 * Une étape de recette : son opération, ses arguments, et de quoi la réordonner,
 * la désactiver ou la retirer. En-tête de 32 px, arguments sur deux colonnes :
 * une recette de cinq étapes doit tenir dans le panneau.
 *
 * Les boutons monter / descendre doublent le glisser-déposer, pour le clavier
 * et les écrans tactiles. À la souris, ils n'apparaissent qu'au survol.
 */
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

const hasArgs = computed(() => Boolean(props.config?.args.length));
const disableLabel = computed(() => (props.step.disabled ? t('app.recipes.enable') : t('app.recipes.disable')));
const collapseLabel = computed(() => (props.step.collapsed ? t('app.recipes.expand') : t('app.recipes.collapse')));
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
      <span class="step-index ct-mono">{{ index + 1 }}</span>
      <span class="step-name">{{ step.op }}</span>
      <span v-if="config && !hasArgs" class="step-note ct-mono">{{ t('app.recipes.noSettings') }}</span>

      <div class="step-actions">
        <button
          type="button"
          class="step-action step-action--move"
          :aria-label="t('app.recipes.moveUp')"
          :title="t('app.recipes.moveUp')"
          :disabled="index === 0"
          @click="emit('move', -1)"
        >
          <icon-mdi-arrow-up aria-hidden="true" />
        </button>
        <button
          type="button"
          class="step-action step-action--move"
          :aria-label="t('app.recipes.moveDown')"
          :title="t('app.recipes.moveDown')"
          :disabled="index === count - 1"
          @click="emit('move', 1)"
        >
          <icon-mdi-arrow-down aria-hidden="true" />
        </button>
        <button
          type="button"
          class="step-action"
          :aria-label="disableLabel"
          :title="disableLabel"
          :aria-pressed="step.disabled"
          @click="emit('toggle-disabled')"
        >
          <icon-mdi-eye-off-outline v-if="step.disabled" aria-hidden="true" />
          <icon-mdi-eye-outline v-else aria-hidden="true" />
        </button>
        <button
          v-if="hasArgs"
          type="button"
          class="step-action"
          :aria-label="collapseLabel"
          :title="collapseLabel"
          :aria-expanded="!step.collapsed"
          @click="emit('toggle-collapsed')"
        >
          <icon-mdi-chevron-down v-if="step.collapsed" aria-hidden="true" />
          <icon-mdi-chevron-up v-else aria-hidden="true" />
        </button>
        <button
          type="button"
          class="step-action"
          :aria-label="t('app.recipes.remove')"
          :title="t('app.recipes.remove')"
          @click="emit('remove')"
        >
          <icon-mdi-close aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="config && hasArgs && !step.collapsed" class="step-body">
      <CcArgsForm v-model:args="args" :config="config" compact />
    </div>
  </section>
</template>

<style scoped>
.step {
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius-panel);
  background: var(--ct-surface);
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.step:focus-within {
  border-color: var(--ct-border-strong);
}

.step--disabled {
  opacity: 0.55;
}

.step--disabled .step-name {
  text-decoration: line-through;
}

.step--failed,
.step--failed:focus-within {
  border-color: var(--ct-error);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ct-error) 18%, transparent);
}

.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 4px;
}

.drag-handle {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--ct-text-faint);
  font-size: 16px;
  cursor: grab;
  touch-action: none;
}

.step-index {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--ct-radius-micro);
  background: var(--ct-primary-faded);
  color: var(--ct-primary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.step-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-note {
  flex-shrink: 0;
  color: var(--ct-text-faint);
  font-size: 11px;
}

.step-actions {
  display: flex;
  flex-shrink: 0;
}

.step-action {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--ct-radius-control);
  background: transparent;
  color: var(--ct-text-muted);
  font-size: 14px;
  cursor: pointer;
}

.step-action:hover:not(:disabled) {
  background: var(--ct-elevated);
  color: var(--ct-text);
}

.step-action:disabled {
  opacity: 0.35;
  cursor: default;
}

/*
 * Monter / descendre : au survol ou au clavier, pour ne pas charger l'en-tête.
 * `:disabled` compris, sans quoi la règle générale le laisserait à demi visible.
 */
.step-action--move,
.step-action--move:disabled {
  opacity: 0;
}

.step:hover .step-action--move,
.step:focus-within .step-action--move {
  opacity: 1;
}

.step:hover .step-action--move:disabled,
.step:focus-within .step-action--move:disabled {
  opacity: 0.35;
}

.step-body {
  padding: 12px;
  border-top: 1px solid var(--ct-border);
}

/* Au doigt : pas de survol, tout reste visible, et des cibles de 44 px. */
@media (hover: none) {
  .step-head {
    height: 44px;
  }

  .step-action {
    width: 44px;
    height: 44px;
  }

  .step-action--move {
    opacity: 1;
  }

  .step-action--move:disabled {
    opacity: 0.35;
  }
}
</style>
