<script setup lang="ts">
/**
 * Panneau d'entrée d'une opération ou d'une recette : texte, ou fichier.
 */
import { formatBytes } from '~/integrations/cyberchef/output';

export interface InputFile {
  name: string;
  size: number;
  buffer: ArrayBuffer;
}

const input = defineModel<string>('input', { required: true });
const file = defineModel<InputFile | undefined>('file');

defineProps<{
  /** Affiche un bouton « Exécuter » : opérations qui ne se relancent pas seules. */
  manual?: boolean;
  running?: boolean;
}>();

const emit = defineEmits<{ run: [] }>();

const { t } = useI18n();
const fileInput = ref<HTMLInputElement>();

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const selected = target.files?.[0];
  if (!selected) return;
  file.value = { name: selected.name, size: selected.size, buffer: await selected.arrayBuffer() };
  target.value = '';
}
</script>

<template>
  <c-card :title="t('app.cc.input')" class="cc-input">
    <div v-if="file" class="file">
      <icon-mdi-file-outline class="file-icon" aria-hidden="true" />
      <span class="file-name">{{ file.name }}</span>
      <span class="file-size">{{ formatBytes(file.size) }}</span>
      <c-button size="small" variant="text" @click="file = undefined">
        {{ t('app.cc.removeFile') }}
      </c-button>
    </div>
    <c-input-text
      v-else
      v-model:value="input"
      multiline
      rows="10"
      raw-text
      :placeholder="t('app.cc.inputPlaceholder')"
      class="mono"
    />

    <div class="actions">
      <input ref="fileInput" type="file" class="sr-only" @change="onFileSelected">
      <c-button @click="fileInput?.click()">
        <icon-mdi-paperclip class="button-icon" aria-hidden="true" />
        {{ t('app.cc.loadFile') }}
      </c-button>
      <c-button v-if="manual" type="primary" :disabled="running" @click="emit('run')">
        {{ t('app.cc.run') }}
      </c-button>
    </div>
  </c-card>
</template>

<style scoped>
.cc-input {
  min-width: 0;
}

/* Sur le conteneur : leur textarea impose « font-family: inherit » avec un sélecteur plus fort. */
.mono :deep(.input-wrapper) {
  font-family: var(--ct-font-mono);
  font-size: 13px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.button-icon {
  margin-right: 6px;
}

.file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--ct-radius-medium);
  border: 1px dashed var(--ct-border);
}

.file-icon {
  font-size: 18px;
  color: var(--ct-primary);
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--ct-text-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
