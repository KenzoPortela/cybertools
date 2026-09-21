<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { AUTHOR } from '~/app/author';

/**
 * Barre d'état, au bas du châssis. À gauche, ce que la page sait d'elle-même
 * (slot par défaut) ; à droite, ce qui ne change pas d'une page à l'autre.
 *
 * Elle reprend pour l'instant le contenu de l'ancien pied de page ; les mesures
 * de session (octets traités, requêtes réseau réellement comptées) viendront
 * s'y ajouter.
 */
const { t } = useI18n();
const version = __APP_VERSION__;
</script>

<template>
  <footer class="status-bar ct-mono">
    <div class="status-left">
      <slot>
        <span class="status-dot" aria-hidden="true" />
        <span class="status-text">{{ t('app.footer.privacy') }}</span>
      </slot>
    </div>

    <div class="status-right">
      <span>v{{ version }}</span>
      <span class="status-sep" aria-hidden="true">·</span>
      <span>GPL-3.0</span>
      <span class="status-sep" aria-hidden="true">·</span>
      <i18n-t keypath="app.footer.madeBy" tag="span" scope="global">
        <template #name>
          <a :href="AUTHOR.github" target="_blank" rel="noopener noreferrer" class="status-link status-author">{{ AUTHOR.name }}</a>
        </template>
      </i18n-t>
      <span class="status-sep" aria-hidden="true">·</span>
      <RouterLink to="/about" class="status-link">
        {{ t('app.footer.about') }}
      </RouterLink>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: var(--ct-statusbar-height);
  padding: 0 16px;
  border-top: 1px solid var(--ct-border);
  background: var(--ct-chassis);
  color: var(--ct-text-faint);
  font-size: 11px;
  white-space: nowrap;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-left {
  overflow: hidden;
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-right {
  flex-shrink: 0;
}

.status-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ct-primary);
}

.status-link {
  color: inherit;
  text-decoration: none;
}

.status-link:hover {
  color: var(--ct-primary);
}

.status-author {
  color: var(--ct-text-muted);
}

/* Sur téléphone, la barre d'onglets prend la place du bas. */
@media (max-width: 639.98px) {
  .status-bar {
    display: none;
  }
}
</style>
