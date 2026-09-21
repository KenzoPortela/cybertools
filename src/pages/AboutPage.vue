<script setup lang="ts">
import { AUTHOR } from '~/app/author';
import { useShellCrumbs } from '~/app/shell';

const { t } = useI18n();

useShellCrumbs(() => [{ label: t('app.nav.about').toLowerCase() }]);

const sources = [
  {
    key: 'cyberchef',
    name: 'CyberChef',
    author: 'GCHQ',
    license: 'Apache 2.0',
    url: 'https://github.com/gchq/CyberChef',
  },
  {
    key: 'itTools',
    name: 'IT-Tools',
    author: 'Corentin Thomasset',
    license: 'GPL-3.0',
    url: 'https://github.com/CorentinTh/it-tools',
  },
];
</script>

<template>
  <div class="page">
    <article class="about">
      <h1 class="title">
        {{ t('app.about.title') }}
      </h1>
      <p class="lead">
        {{ t('app.about.intro') }}
      </p>

      <section class="author" :aria-label="t('app.about.authorTitle')">
        <p class="author-text">
          <i18n-t keypath="app.about.author" tag="span" scope="global">
            <template #name>
              <strong>{{ AUTHOR.name }}</strong>
            </template>
          </i18n-t>
        </p>
        <div class="author-links">
          <a :href="AUTHOR.github" target="_blank" rel="noopener noreferrer" class="author-link">
            <icon-mdi-github aria-hidden="true" />
            <span class="ct-mono">github.com/KenzoPortela</span>
          </a>
          <a :href="AUTHOR.website" target="_blank" rel="noopener noreferrer" class="author-link">
            <icon-mdi-web aria-hidden="true" />
            <span class="ct-mono">kenzoportela.com</span>
          </a>
        </div>
      </section>

      <section class="block">
        <h2>{{ t('app.about.privacyTitle') }}</h2>
        <p>{{ t('app.about.privacyBody') }}</p>
      </section>

      <section class="block">
        <h2>{{ t('app.about.creditsTitle') }}</h2>
        <p>{{ t('app.about.creditsBody') }}</p>

        <ul class="sources">
          <li v-for="source in sources" :key="source.key" class="source">
            <div class="source-head">
              <a :href="source.url" target="_blank" rel="noopener noreferrer" class="source-name">{{ source.name }}</a>
              <span class="source-license">{{ source.license }}</span>
            </div>
            <p class="source-meta">
              {{ t('app.about.by', { author: source.author }) }} — {{ t(`app.about.${source.key}`) }}
            </p>
          </li>
        </ul>
      </section>

      <section class="block">
        <h2>{{ t('app.about.licenseTitle') }}</h2>
        <p>{{ t('app.about.licenseBody') }}</p>
      </section>
    </article>
  </div>
</template>

<style scoped>
.about {
  max-width: 720px;
  margin: 0 auto;
}

.title {
  font-size: clamp(26px, 4vw, 34px);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 8px 0 12px;
}

.lead {
  font-size: 16px;
  color: var(--ct-text-muted);
  line-height: 1.6;
  margin: 0 0 32px;
}

.author {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 36px;
  padding: 16px 18px;
  border: 1px solid var(--ct-border);
  border-left: 3px solid var(--ct-primary);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
}

.author-text {
  margin: 0;
  line-height: 1.5;
}

.author-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.author-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ct-text-muted);
  text-decoration: none;
}

.author-link:hover {
  color: var(--ct-primary);
}

.block {
  margin-bottom: 32px;
}

.block h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
}

.block p {
  line-height: 1.6;
  margin: 0;
}

.sources {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  gap: 10px;
}

.source {
  padding: 14px 16px;
  border: 1px solid var(--ct-border);
  border-radius: var(--ct-radius);
  background: var(--ct-surface);
}

.source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.source-name {
  font-weight: 600;
  text-decoration: none;
}

.source-license {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ct-neutral);
  color: var(--ct-text-muted);
}

.source-meta {
  margin: 6px 0 0 !important;
  font-size: 14px;
  color: var(--ct-text-muted);
}

@media (hover: none) {
  .author-link,
  .source-name {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}
</style>
