<script setup lang="ts">
/**
 * Visualiseur d'image partagé par tous les panneaux du Stego Lab : zoom, pan,
 * lecture de la valeur du pixel survolé, export PNG. On lui passe des pixels
 * (`ImageData`) — l'original au lot 1, un plan de bits ou une carte d'entropie
 * aux lots suivants.
 */
import { useElementSize } from '@vueuse/core';

const props = defineProps<{
  image?: ImageData;
  /** Nom de base du fichier exporté. */
  filename?: string;
}>();

const { t } = useI18n();

const container = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
const { width: viewW, height: viewH } = useElementSize(container);

// Canvas source : reçoit les pixels une fois, sert de source au rendu zoomé.
let source: HTMLCanvasElement | undefined;

const scale = ref(1);
const offset = reactive({ x: 0, y: 0 });
const hover = ref<{ x: number; y: number; r: number; g: number; b: number; a: number }>();

function ensureSource(data: ImageData) {
  if (!source) source = document.createElement('canvas');
  source.width = data.width;
  source.height = data.height;
  source.getContext('2d')!.putImageData(data, 0, 0);
}

/** Cadre l'image dans la vue, centrée. */
function fit() {
  if (!props.image || !viewW.value || !viewH.value) return;
  const factor = Math.min(viewW.value / props.image.width, viewH.value / props.image.height, 1);
  scale.value = factor || 1;
  offset.x = (viewW.value - props.image.width * scale.value) / 2;
  offset.y = (viewH.value - props.image.height * scale.value) / 2;
}

function draw() {
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext('2d')!;
  el.width = viewW.value;
  el.height = viewH.value;
  ctx.clearRect(0, 0, el.width, el.height);
  if (!source || !props.image) return;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale.value, 0, 0, scale.value, offset.x, offset.y);
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

watch(() => props.image, (data) => {
  if (data) {
    ensureSource(data);
    fit();
  }
  draw();
}, { immediate: true });

watch([viewW, viewH], () => {
  if (scale.value === 1 && offset.x === 0 && offset.y === 0) fit();
  draw();
});

watch([scale, offset], draw, { deep: true });

function toImageCoords(event: PointerEvent | WheelEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const px = (event.clientX - rect.left - offset.x) / scale.value;
  const py = (event.clientY - rect.top - offset.y) / scale.value;
  return { px, py };
}

function onWheel(event: WheelEvent) {
  if (!props.image) return;
  event.preventDefault();
  const { px, py } = toImageCoords(event);
  const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
  const next = Math.min(Math.max(scale.value * factor, 0.05), 64);
  // Zoom centré sur le curseur : le pixel sous la souris ne bouge pas.
  offset.x -= px * (next - scale.value);
  offset.y -= py * (next - scale.value);
  scale.value = next;
}

let panning = false;
let panStart = { x: 0, y: 0, ox: 0, oy: 0 };

function onPointerDown(event: PointerEvent) {
  if (!props.image) return;
  panning = true;
  panStart = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  canvas.value!.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (panning) {
    offset.x = panStart.ox + (event.clientX - panStart.x);
    offset.y = panStart.oy + (event.clientY - panStart.y);
    return;
  }
  if (!props.image) return;
  const { px, py } = toImageCoords(event);
  const x = Math.floor(px);
  const y = Math.floor(py);
  if (x < 0 || y < 0 || x >= props.image.width || y >= props.image.height) {
    hover.value = undefined;
    return;
  }
  const i = (y * props.image.width + x) * 4;
  const d = props.image.data;
  hover.value = { x, y, r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
}

function onPointerUp(event: PointerEvent) {
  panning = false;
  canvas.value?.releasePointerCapture(event.pointerId);
}

function zoom(factor: number) {
  const next = Math.min(Math.max(scale.value * factor, 0.05), 64);
  offset.x = viewW.value / 2 - (viewW.value / 2 - offset.x) * (next / scale.value);
  offset.y = viewH.value / 2 - (viewH.value / 2 - offset.y) * (next / scale.value);
  scale.value = next;
}

function exportPng() {
  if (!source) return;
  source.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.filename || 'image'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
</script>

<template>
  <div class="viewer">
    <div ref="container" class="stage" :class="{ 'stage--empty': !image }">
      <canvas
        ref="canvas"
        class="canvas"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="hover = undefined"
      />
    </div>

    <div class="toolbar">
      <div class="zoom">
        <c-button size="small" :aria-label="t('app.stego.zoomOut')" @click="zoom(1 / 1.4)">
          <icon-mdi-minus />
        </c-button>
        <span class="zoom-value ct-mono">{{ Math.round(scale * 100) }}%</span>
        <c-button size="small" :aria-label="t('app.stego.zoomIn')" @click="zoom(1.4)">
          <icon-mdi-plus />
        </c-button>
        <c-button size="small" @click="fit">
          {{ t('app.stego.fit') }}
        </c-button>
      </div>

      <span v-if="hover" class="readout ct-mono">
        {{ t('app.stego.pixel', { x: hover.x, y: hover.y }) }} · rgba({{ hover.r }}, {{ hover.g }}, {{ hover.b }}, {{ hover.a }})
      </span>
      <span v-else class="readout ct-mono muted">{{ t('app.stego.hoverHint') }}</span>

      <c-button size="small" :disabled="!image" class="stego-export" @click="exportPng">
        <icon-mdi-download class="icon" />
        {{ t('app.stego.exportPng') }}
      </c-button>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.stage {
  position: relative;
  height: min(62vh, 620px);
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background:
    repeating-conic-gradient(var(--ct-elevated) 0% 25%, transparent 0% 50%) 0 / 20px 20px;
  overflow: hidden;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}

.canvas:active {
  cursor: grabbing;
}

.stage--empty .canvas {
  cursor: default;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.zoom {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-value {
  min-width: 46px;
  text-align: center;
  font-size: 12px;
  color: var(--ct-text-muted);
}

.readout {
  font-size: 12px;
  color: var(--ct-text);
}

.readout.muted {
  color: var(--ct-text-muted);
}

.stego-export {
  margin-left: auto;
}

.icon {
  margin-right: 6px;
}
</style>
