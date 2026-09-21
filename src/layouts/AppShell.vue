<script setup lang="ts">
import { onKeyStroke, useMediaQuery } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { installCommandPaletteShortcuts, useCommandPalette } from '~/app/command-palette';
import { catalog } from '~/catalog/catalog';
import CommandPalette from '~/components/CommandPalette.vue';
import NavRail from '~/components/shell/NavRail.vue';
import StatusBar from '~/components/shell/StatusBar.vue';
import TabBar from '~/components/shell/TabBar.vue';
import TopBar from '~/components/shell/TopBar.vue';
import { useSettingsStore } from '~/stores/settings';

/**
 * Châssis de l'application : un rail de navigation permanent, une barre du
 * haut, une barre d'état — et entre les deux, la page, qui déclare elle-même sa
 * largeur (`.page`) ou prend tout l'écran.
 *
 * C'est le document qui défile, pas une zone intérieure : le rail et les deux
 * barres restent en place par `position: sticky`. Le routeur retrouve ainsi sa
 * position de défilement, et une capture pleine page voit toute la page.
 *
 * Trois formes selon la largeur :
 *  - ≥ 1024 px : rail en colonne, repliable en icônes (réglage mémorisé) ;
 *  - < 1024 px : rail en tiroir, ouvert depuis la barre du haut ;
 *  - < 640 px : en plus, une barre d'onglets en bas, à portée de pouce.
 */
const { settings } = storeToRefs(useSettingsStore());
const route = useRoute();
const { isOpen: paletteOpen } = useCommandPalette();

installCommandPaletteShortcuts();

const isWide = useMediaQuery('(min-width: 1024px)');

/**
 * Espaces de travail (l'atelier, le Stego Lab) : leurs panneaux ont besoin de
 * la largeur, le rail s'y replie de lui-même. Ce repli ne touche pas au réglage
 * enregistré ; le bouton du rail le défait, le temps de la visite.
 */
const inWorkspace = computed(() => {
  if (route.name !== 'tool') return false;
  const layout = catalog.toolForSlug(String(route.params.slug))?.layout;
  return layout === 'full' || layout === 'workspace';
});
const expandedHere = ref(false);
watch(() => route.path, () => {
  expandedHere.value = false;
});

const collapsed = computed(() => isWide.value && (inWorkspace.value ? !expandedHere.value : settings.value.shellRailCollapsed));

function toggleCollapse() {
  if (inWorkspace.value) expandedHere.value = !expandedHere.value;
  else settings.value.shellRailCollapsed = !settings.value.shellRailCollapsed;
}

// --- Tiroir -----------------------------------------------------------------

const drawerOpen = ref(false);
const topBar = ref<InstanceType<typeof TopBar>>();

/**
 * Tiroir fermé : le rail est hors écran, et `inert` le sort aussi de l'ordre de
 * tabulation et de l'arbre d'accessibilité. (Un `visibility: hidden` ferait de
 * même, mais le navigateur refuse alors le focus tant qu'il n'a pas recalculé le
 * style — le focus posé à l'ouverture se perdait.)
 */
const railInert = computed(() => !isWide.value && !drawerOpen.value);

/**
 * Ouvre le tiroir et y place le focus : sur la section des épinglés quand c'est
 * elle qu'on est venu chercher, sinon sur la première commande.
 */
async function openDrawer(section?: 'pinned') {
  drawerOpen.value = true;
  await nextTick();
  const rail = document.getElementById('ct-nav-rail');
  const target = section === 'pinned'
    ? rail?.querySelector<HTMLElement>('#rail-pinned')
    : rail?.querySelector<HTMLElement>('a, button');
  target?.scrollIntoView({ block: 'nearest' });
  target?.focus();
}

async function closeDrawer({ restoreFocus = true } = {}) {
  if (!drawerOpen.value) return;
  drawerOpen.value = false;
  if (!restoreFocus) return;
  await nextTick();
  topBar.value?.focusMenu();
}

/** Un lien suivi dans le tiroir le referme, même s'il mène à la page courante. */
function onRailClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('a')) closeDrawer({ restoreFocus: false });
}

onKeyStroke('Escape', () => {
  if (drawerOpen.value && !paletteOpen.value) closeDrawer();
});

// Le tiroir n'a pas de sens en grand écran : il se referme si la fenêtre
// s'élargit, sans quoi la page resterait inerte derrière un rail en colonne.
watch(isWide, (wide) => {
  if (wide) closeDrawer({ restoreFocus: false });
});
watch(() => route.fullPath, () => closeDrawer({ restoreFocus: false }));
// La recherche lancée depuis le tiroir prend le relais.
watch(paletteOpen, (open) => {
  if (open) closeDrawer({ restoreFocus: false });
});
</script>

<template>
  <div
    class="shell"
    :class="{ 'shell--collapsed': collapsed, 'shell--drawer-open': drawerOpen }"
  >
    <NavRail
      id="ct-nav-rail"
      class="shell-rail"
      :inert="railInert || undefined"
      :collapsed="collapsed"
      @toggle-collapse="toggleCollapse"
      @click="onRailClick"
    />

    <div v-if="drawerOpen" class="shell-scrim" aria-hidden="true" @click="closeDrawer()" />

    <div class="shell-main" :inert="drawerOpen || undefined">
      <TopBar ref="topBar" :drawer-open="drawerOpen" @open-drawer="openDrawer()" />

      <main class="shell-content">
        <slot />
      </main>

      <StatusBar />
      <TabBar @open-pinned="openDrawer('pinned')" />
    </div>

    <CommandPalette />
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--ct-rail-width) minmax(0, 1fr);
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--ct-background);
  transition: grid-template-columns 0.2s ease;
}

.shell--collapsed {
  grid-template-columns: var(--ct-rail-collapsed-width) minmax(0, 1fr);
}

.shell-rail {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
}

.shell-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
}

.shell-content {
  flex: 1;
  min-width: 0;
}

/* Tiroir : le rail sort de la grille et glisse depuis la gauche. */
@media (max-width: 1023.98px) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .shell-rail {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    width: min(280px, 85vw);
    box-shadow: var(--ct-shadow);
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .shell--drawer-open .shell-rail {
    transform: none;
  }

  .shell-scrim {
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgb(0 0 0 / 0.45);
  }
}

/* La barre d'onglets est posée par-dessus le bas de page : on lui fait place. */
@media (max-width: 639.98px) {
  .shell-content {
    padding-bottom: calc(var(--ct-tabbar-height) + env(safe-area-inset-bottom));
  }
}
</style>
