<script setup lang="ts">
/**
 * Un argument d'opération CyberChef, rendu avec les composants d'IT-Tools et de
 * naive-ui : un formulaire CyberChef ne doit pas se distinguer d'un outil
 * IT-Tools. Couvre les 15 types d'arguments présents dans les 505 opérations.
 */
import { NAutoComplete, NInputNumber, NSwitch } from 'naive-ui';
import {
  type ArgConfig,
  type NamedValue,
  type ToggleString,
  isSubheading,
  selectableOptions,
} from '~/integrations/cyberchef/operations';

const props = defineProps<{
  arg: ArgConfig;
  value: unknown;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:value': [value: unknown];
  /** populateOption : préremplir d'autres arguments. */
  'populate': [target: number | number[], value: unknown];
}>();

const named = computed(() =>
  Array.isArray(props.arg.value)
    ? (props.arg.value as NamedValue[]).filter(entry => !isSubheading(entry.name))
    : [],
);

const options = computed(() => (props.arg.type === 'option' ? selectableOptions(props.arg) : []));

const editableOptions = computed(() =>
  named.value.map(entry => ({ label: entry.name, value: String(entry.value) })),
);

const toggle = computed(() => props.value as ToggleString);

function setToggle(patch: Partial<ToggleString>) {
  emit('update:value', { ...toggle.value, ...patch });
}

function populate(name: string) {
  emit('update:value', name);
  const choice = named.value.find(entry => entry.name === name);
  if (choice && props.arg.target !== undefined) emit('populate', props.arg.target, choice.value);
}

/** Les listes longues deviennent filtrables au clavier. */
const searchable = computed(() => options.value.length > 8 || named.value.length > 8);
</script>

<template>
  <div
    class="field"
    :class="{ 'field--wide': arg.type === 'text' || arg.type === 'toggleString', 'field--disabled': disabled }"
    :title="arg.hint || undefined"
    :aria-disabled="disabled || undefined"
  >
    <label v-if="arg.type !== 'label'" class="field-label">{{ arg.name }}</label>

    <NSwitch
      v-if="arg.type === 'boolean'"
      :value="Boolean(value)"
      :disabled="disabled"
      @update:value="(v: boolean) => emit('update:value', v)"
    />

    <NInputNumber
      v-else-if="arg.type === 'number'"
      :value="value as number"
      :min="arg.min"
      :max="arg.max"
      :step="arg.step ?? 1"
      :precision="arg.integer ? 0 : undefined"
      :disabled="disabled"
      @update:value="(v: number | null) => emit('update:value', v ?? arg.value)"
    />

    <c-select
      v-else-if="arg.type === 'option'"
      :value="value as string"
      :options="options"
      :searchable="searchable"
      :disabled="disabled"
      @update:value="(v: string) => emit('update:value', v)"
    />

    <NAutoComplete
      v-else-if="arg.type === 'editableOption' || arg.type === 'editableOptionShort'"
      :value="value as string"
      :options="editableOptions"
      :get-show="() => true"
      :disabled="disabled"
      :placeholder="arg.hint ?? ''"
      @update:value="(v: string) => emit('update:value', v)"
    />

    <div v-else-if="arg.type === 'toggleString'" class="toggle">
      <c-input-text
        :value="toggle.string"
        :disabled="disabled"
        raw-text
        :placeholder="arg.hint ?? ''"
        class="toggle-text"
        @update:value="(v: string) => setToggle({ string: v })"
      />
      <c-select
        :value="toggle.option"
        :options="arg.toggleValues ?? []"
        :disabled="disabled"
        class="toggle-option"
        @update:value="(v: string) => setToggle({ option: v })"
      />
    </div>

    <c-select
      v-else-if="arg.type === 'argSelector'"
      :value="value as string"
      :options="named.map(entry => entry.name)"
      :searchable="searchable"
      :disabled="disabled"
      @update:value="(v: string) => emit('update:value', v)"
    />

    <c-select
      v-else-if="arg.type === 'populateOption' || arg.type === 'populateMultiOption'"
      :value="value as string"
      :options="named.map(entry => entry.name)"
      :searchable="searchable"
      :disabled="disabled"
      @update:value="populate"
    />

    <c-input-text
      v-else-if="arg.type === 'text'"
      :value="value as string"
      multiline
      :rows="arg.rows || 3"
      raw-text
      :disabled="disabled"
      :placeholder="arg.hint ?? ''"
      @update:value="(v: string) => emit('update:value', v)"
    />

    <p v-else-if="arg.type === 'label'" class="field-note">
      {{ arg.name }}
    </p>

    <c-input-text
      v-else
      :value="value as string"
      raw-text
      :disabled="disabled"
      :placeholder="arg.hint ?? ''"
      @update:value="(v: string) => emit('update:value', v)"
    />
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/*
 * Désactivé au niveau du champ entier : c-select d'IT-Tools n'a pas de prop
 * disabled, et un argument coupé par un sélecteur doit l'être visiblement.
 */
.field--disabled {
  opacity: 0.45;
  pointer-events: none;
}

.field--wide {
  grid-column: 1 / -1;
}

/* Un interrupteur garde sa largeur naturelle, aligné sous son libellé. */
.field > :deep(.n-switch) {
  align-self: flex-start;
}

.field-label {
  font-size: 13px;
  color: var(--ct-text-muted);
}

.field-note {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ct-text);
}

.toggle {
  display: flex;
  gap: 8px;
}

.toggle-text {
  flex: 1;
  min-width: 0;
}

.toggle-option {
  flex: 0 0 120px;
}
</style>
