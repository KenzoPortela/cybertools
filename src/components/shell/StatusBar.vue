<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { AUTHOR } from '~/app/author';
import { type StatusItem, shellStatus } from '~/app/shell';
import { formatBytes } from '~/integrations/cyberchef/output';
import { useSessionStore } from '~/stores/session';

/**
 * Barre d'état, au bas du châssis. Elle dit la vérité, mesurée :
 *  - à gauche, ce que la page sait d'elle-même (useShellStatus) ou, à défaut,
 *    ce que le moteur a calculé depuis l'ouverture de la page ;
 *  - à droite, ce qui vaut pour toute l'application : les requêtes parties vers
 *    un autre site, comptées par le navigateur, puis version et licence.
 */
const { t } = useI18n();
const { operations, bytesProcessed, networkRequests, networkOrigins, networkBlocked } = storeToRefs(useSessionStore());
const version = __APP_VERSION__;

const items = computed<StatusItem[]>(() => shellStatus.value ?? [{
  text: t('app.status.session', {
    operations: t('app.status.operations', operations.value),
    bytes: formatBytes(bytesProcessed.value),
  }),
}]);

const networkTitle = computed(() => (networkRequests.value
  ? t('app.status.networkSome', { origins: networkOrigins.value.join(', ') })
  : t('app.status.networkNone')));
</script>

<template>
  <footer class="status-bar ct-mono">
    <ul class="status-left">
      <li v-for="(item, index) in items" :key="index" class="status-item">
        <span v-if="item.tone" class="status-dot" :class="`status-dot--${item.tone}`" aria-hidden="true" />
        <span class="status-text">{{ item.text }}</span>
      </li>
    </ul>

    <div class="status-right">
      <span class="status-item status-network" :title="networkTitle">
        <span class="status-dot" :class="networkRequests ? 'status-dot--warning' : 'status-dot--live'" aria-hidden="true" />
        {{ t('app.status.network', networkRequests) }}
        <template v-if="networkBlocked">
          · {{ t('app.status.blocked', networkBlocked) }}
        </template>
      </span>
      <span class="status-sep" aria-hidden="true">·</span>
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

.status-left {
  display: flex;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}

/* Un filet entre deux mesures, comme dans une barre d'état d'éditeur. */
.status-left .status-item + .status-item {
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--ct-border);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ct-text-faint);
}

/* L'accent est réservé à ce qui est vivant : la mesure qui tient sa promesse. */
.status-dot--live {
  background: var(--ct-primary);
}

.status-dot--success {
  background: var(--ct-success);
}

.status-dot--warning {
  background: var(--ct-warning);
}

.status-dot--error {
  background: var(--ct-error);
}

.status-network {
  cursor: help;
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

/* Au doigt, la barre passe à 44 px (voir global.css) : ses liens en prennent la hauteur. */
@media (hover: none) {
  .status-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}

/* Sur téléphone, la barre d'onglets prend la place du bas. */
@media (max-width: 639.98px) {
  .status-bar {
    display: none;
  }
}
</style>
