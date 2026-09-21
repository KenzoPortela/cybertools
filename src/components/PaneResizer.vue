<script setup lang="ts">
/**
 * Séparateur redimensionnable entre deux panneaux : il règle la largeur du
 * panneau de gauche.
 *
 * Accessible au clavier comme à la souris : c'est un `role="separator"`
 * focalisable, que les flèches déplacent de 16 px (Début et Fin : aux bornes).
 * Le trait visible fait 1 px ; la zone de prise, 8 px.
 */
const props = defineProps<{
  min: number;
  max: number;
  /** Nom accessible : ce que le séparateur redimensionne. */
  label: string;
}>();

const width = defineModel<number>({ required: true });

const STEP = 16;
const dragging = ref(false);

function clamp(value: number) {
  return Math.round(Math.min(props.max, Math.max(props.min, value)));
}

/**
 * Dernière largeur demandée. Le modèle ne revient du parent qu'au rendu
 * suivant : deux flèches dans le même instant (touche maintenue) liraient sinon
 * la même valeur, et un pas serait perdu.
 */
let latest = width.value;
watch(width, (value) => {
  latest = value;
});

function setWidth(value: number) {
  latest = clamp(value);
  width.value = latest;
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  const startX = event.clientX;
  const startWidth = width.value;
  handle.setPointerCapture(event.pointerId);
  dragging.value = true;

  const move = (moveEvent: PointerEvent) => {
    setWidth(startWidth + moveEvent.clientX - startX);
  };
  const stop = () => {
    dragging.value = false;
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', stop);
    handle.removeEventListener('pointercancel', stop);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function onKeydown(event: KeyboardEvent) {
  const next = {
    ArrowLeft: latest - STEP,
    ArrowRight: latest + STEP,
    Home: props.min,
    End: props.max,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  setWidth(next);
}
</script>

<template>
  <div
    class="resizer"
    :class="{ 'resizer--dragging': dragging }"
    role="separator"
    aria-orientation="vertical"
    tabindex="0"
    :aria-label="label"
    :aria-valuenow="width"
    :aria-valuemin="min"
    :aria-valuemax="max"
    @pointerdown="onPointerDown"
    @keydown="onKeydown"
  />
</template>

<style scoped>
.resizer {
  position: relative;
  width: 1px;
  background: var(--ct-border);
  cursor: col-resize;
  touch-action: none;
  transition: background-color 0.15s ease;
}

/* Zone de prise plus large que le trait. */
.resizer::before {
  content: '';
  position: absolute;
  inset: 0 -4px;
  z-index: 1;
}

.resizer:hover,
.resizer--dragging,
.resizer:focus-visible {
  background: var(--ct-primary);
}

.resizer:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--ct-primary);
}

@media (hover: none) {
  .resizer::before {
    inset: 0 -12px;
  }
}
</style>
