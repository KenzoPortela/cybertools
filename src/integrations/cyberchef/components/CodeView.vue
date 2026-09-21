<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core';

/**
 * Zone de texte des panneaux d'entrée et de sortie, avec une gouttière :
 * numéros de ligne côté entrée, offsets (en octets, en hexadécimal) côté
 * sortie.
 *
 * Le texte reste une vraie <textarea> — sélection, copie, lecteurs d'écran,
 * annulation du navigateur. Les lignes ne se replient pas : une donnée se lit
 * ligne à ligne, et la gouttière doit tomber en face. Elle ne dessine que les
 * lignes visibles, pour tenir sur une entrée de plusieurs mégaoctets.
 */
const props = withDefaults(defineProps<{
  value: string;
  readonly?: boolean;
  /** `lines` : 1, 2, 3… ; `offsets` : position en octets du début de chaque ligne. */
  gutter?: 'lines' | 'offsets';
  placeholder?: string;
  /** Nom accessible de la zone. */
  label: string;
}>(), {
  readonly: false,
  gutter: 'lines',
  placeholder: '',
});

const emit = defineEmits<{
  'update:value': [value: string];
  /** Position du curseur, en ligne et colonne (à partir de 1). */
  'cursor': [position: { line: number; col: number }];
  /** Ctrl+Entrée (⌘+Entrée) : exécuter tout de suite. */
  'run': [];
}>();

/** Hauteur d'une ligne, en px : la gouttière s'aligne dessus. */
const LINE = 20;
/** Marge haute du texte, reprise par la gouttière. */
const PAD = 8;

const textarea = ref<HTMLTextAreaElement>();
const scrollTop = ref(0);
const viewport = ref(0);

const lineCount = computed(() => {
  let count = 1;
  for (let i = 0; i < props.value.length; i++) {
    if (props.value.charCodeAt(i) === 10) count++;
  }
  return count;
});

const encoder = new TextEncoder();

/** Offset en octets (UTF-8) du début de chaque ligne ; calculé seulement pour la sortie. */
const offsets = computed(() => {
  if (props.gutter !== 'offsets') return [];
  const starts = [0];
  let bytes = 0;
  for (const line of props.value.split('\n')) {
    bytes += encoder.encode(line).length + 1;
    starts.push(bytes);
  }
  return starts;
});

const visible = computed(() => {
  const first = Math.max(0, Math.floor((scrollTop.value - PAD) / LINE));
  const last = Math.min(lineCount.value, first + Math.ceil(viewport.value / LINE) + 2);
  const lines: { index: number; label: string }[] = [];
  for (let index = first; index < last; index++) {
    const label = props.gutter === 'offsets'
      ? (offsets.value[index] ?? 0).toString(16).padStart(8, '0')
      : String(index + 1);
    lines.push({ index, label });
  }
  return lines;
});

const gutterWidth = computed(() => (props.gutter === 'offsets' ? '8ch' : `${Math.max(2, String(lineCount.value).length)}ch`));

function measure() {
  if (!textarea.value) return;
  scrollTop.value = textarea.value.scrollTop;
  viewport.value = textarea.value.clientHeight;
}

useResizeObserver(textarea, measure);
onMounted(measure);

function reportCursor() {
  const el = textarea.value;
  if (!el) return;
  const before = el.value.slice(0, el.selectionStart);
  const line = before.split('\n').length;
  const col = before.length - before.lastIndexOf('\n');
  emit('cursor', { line, col });
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    emit('run');
  }
}

defineExpose({ focus: () => textarea.value?.focus() });
</script>

<template>
  <div class="code" :style="{ '--gutter-width': gutterWidth }">
    <div class="code-gutter ct-mono" aria-hidden="true">
      <div class="code-gutter-track" :style="{ height: `${lineCount * LINE + PAD * 2}px`, transform: `translateY(${-scrollTop}px)` }">
        <span
          v-for="line in visible"
          :key="line.index"
          class="code-gutter-line"
          :style="{ top: `${PAD + line.index * LINE}px` }"
        >{{ line.label }}</span>
      </div>
    </div>
    <textarea
      ref="textarea"
      class="code-text ct-mono"
      :value="value"
      :readonly="readonly"
      :placeholder="placeholder"
      :aria-label="label"
      wrap="off"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      @input="emit('update:value', ($event.target as HTMLTextAreaElement).value)"
      @scroll="measure"
      @click="reportCursor"
      @keyup="reportCursor"
      @select="reportCursor"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.code {
  display: flex;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--ct-input-background);
}

/* Le texte n'a pas de contour propre : c'est le bloc entier qui montre le focus. */
.code:focus-within {
  outline: 2px solid var(--ct-primary);
  outline-offset: -2px;
}

.code-gutter {
  position: relative;
  flex-shrink: 0;
  width: calc(var(--gutter-width) + 24px);
  overflow: hidden;
  border-right: 1px solid var(--ct-border);
  color: var(--ct-text-faint);
  font-size: var(--ct-font-size-data);
  user-select: none;
}

.code-gutter-track {
  position: relative;
}

.code-gutter-line {
  position: absolute;
  right: 12px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

.code-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 8px 12px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ct-text);
  font-size: var(--ct-font-size-data);
  line-height: 20px;
  resize: none;
  white-space: pre;
  overflow: auto;
  tab-size: 4;
}

.code-text::placeholder {
  color: var(--ct-text-faint);
}
</style>
