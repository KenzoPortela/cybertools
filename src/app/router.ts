import { type RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';
import { registry } from '~/catalog/registry';
import HomePage from '~/pages/HomePage.vue';

// Page de développement : vitrine du design system. Présente en dev, et
// activable dans un build avec VITE_DEV_PAGES=true.
const devPagesEnabled = import.meta.env.DEV || import.meta.env.VITE_DEV_PAGES === 'true';

const devRoutes: RouteRecordRaw[] = devPagesEnabled
  ? [
      {
        path: '/_design/:component?',
        name: 'dev-design',
        component: () => import('~/pages/dev/DesignSystemPage.vue'),
      },
    ]
  : [];

/**
 * Les URL d'IT-Tools (`/hash-text`, et leurs propres anciens alias) mènent
 * toujours au bon outil : un favori de navigateur ou un lien partagé vers
 * IT-Tools reste valable ici.
 */
const aliasRoutes: RouteRecordRaw[] = [...registry.aliases].map(([alias, slug]) => ({
  path: alias,
  redirect: { name: 'tool', params: { slug } },
}));

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Même page, seul le fragment change (l'atelier de recettes y écrit la
  // recette) : on ne bouge pas. Sinon, position mémorisée ou haut de page.
  scrollBehavior: (to, from, saved) => (to.path === from.path ? false : saved ?? { top: 0 }),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    // Les adresses sont en anglais, comme le site par défaut ; les anciennes,
    // françaises, restent valables (alias : même page, sans redirection).
    { path: '/tools/:slug', alias: '/outils/:slug', name: 'tool', component: () => import('~/pages/ToolPage.vue') },
    { path: '/categories/:id', name: 'category', component: () => import('~/pages/CategoryPage.vue') },
    { path: '/about', alias: '/a-propos', name: 'about', component: () => import('~/pages/AboutPage.vue') },
    { path: '/settings', alias: '/parametres', name: 'settings', component: () => import('~/pages/SettingsPage.vue') },
    ...devRoutes,
    ...aliasRoutes,
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('~/pages/NotFoundPage.vue') },
  ],
});

export default router;
