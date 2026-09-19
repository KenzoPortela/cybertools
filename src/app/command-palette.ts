import { useEventListener } from '@vueuse/core';
import { ref } from 'vue';

const isOpen = ref(false);

export const isMac = typeof navigator !== 'undefined'
  && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/** Libellé du raccourci, adapté au système. */
export const paletteShortcutLabel = isMac ? '⌘ K' : 'Ctrl K';

export function useCommandPalette() {
  return {
    isOpen,
    open: () => { isOpen.value = true; },
    close: () => { isOpen.value = false; },
    toggle: () => { isOpen.value = !isOpen.value; },
  };
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Raccourcis globaux, à installer une seule fois (dans le layout de base) :
 *  - Ctrl+K / ⌘K ouvre ou ferme la palette, où que soit le focus ;
 *  - « / » l'ouvre, sauf quand on est en train de taper — sinon on ne pourrait
 *    plus saisir de barre oblique dans un outil.
 */
export function installCommandPaletteShortcuts() {
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      isOpen.value = !isOpen.value;
      return;
    }

    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !isOpen.value && !isTypingTarget(event.target)) {
      event.preventDefault();
      isOpen.value = true;
    }
  });
}
