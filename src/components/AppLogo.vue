<script setup lang="ts">
/**
 * Logo de cybertools, dans la couleur d'accent du thème.
 *
 * Trois propositions sont en lice (voir l'étape 11) ; `LOGO` désigne celle
 * affichée. La même forme sert de favicon (public/favicon.svg).
 */
const LOGO: 'knife' | 'prompt' | 'hex' = 'hex';

withDefaults(defineProps<{ size?: number }>(), { size: 24 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" class="logo" aria-hidden="true" focusable="false">
    <template v-if="LOGO === 'hex'">
      <path class="fill stroke" d="M16 2.8 L27.4 9.4 V22.6 L16 29.2 L4.6 22.6 V9.4 Z" stroke-width="3" stroke-linejoin="round" />
      <path class="cut" d="M10.2 11.6 L14.6 16 L10.2 20.4" fill="none" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
      <path class="cut" d="M16.4 20.4 H21.8" stroke-width="2.8" stroke-linecap="round" />
    </template>
    <template v-else-if="LOGO === 'prompt'">
      <rect class="fill" x="2" y="2" width="28" height="28" rx="8" />
      <path class="cut" d="M9.5 10.5 L15 16 L9.5 21.5" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path class="cut" d="M17 21.5 H23" stroke-width="3" stroke-linecap="round" />
    </template>
    <template v-else>
      <path class="fill" d="M14.2 17.8 L26.6 5.4 Q28.6 3.6 28.9 5.9 Q28.7 8.4 26.6 10.6 L17.6 19.6 Z" />
      <path class="line" d="M10.4 21.4 L5.6 16.6" stroke-width="2.4" stroke-linecap="round" />
      <path class="line" d="M5.6 16.6 L4.2 15.2" stroke-width="3.6" stroke-linecap="round" />
      <path class="line" d="M7.5 25 L17 15.5" stroke-width="9.5" stroke-linecap="round" />
      <circle class="dot" cx="9.2" cy="23.3" r="1.5" />
      <circle class="dot" cx="15.3" cy="17.2" r="1.5" />
    </template>
  </svg>
</template>

<style scoped>
.logo {
  display: block;
  flex-shrink: 0;
}

.fill {
  fill: var(--ct-primary);
}

.stroke,
.line {
  stroke: var(--ct-primary);
}

/* Les « découpes » prennent la couleur du fond : le logo reste net sur toute surface. */
.cut {
  stroke: var(--ct-background);
}

.dot {
  fill: var(--ct-background);
}
</style>
