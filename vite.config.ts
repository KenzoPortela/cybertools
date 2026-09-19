import { URL, fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import VueI18n from '@intlify/unplugin-vue-i18n/vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import Unocss from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import IconsResolver from 'unplugin-icons/resolver';
import Icons from 'unplugin-icons/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import Markdown from 'unplugin-vue-markdown/vite';
import { defineConfig } from 'vite';
import svgLoader from 'vite-svg-loader';
import { vendorOverrides } from './build/vite/vendor-overrides';

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const { version } = JSON.parse(readFileSync(r('./package.json'), 'utf8')) as { version: string };

/**
 * Les composants d'outils d'IT-Tools sont consommés là où ils sont, dans vendor/,
 * sans copie ni patch. Ils importent leurs propres dépendances en `@/...`, d'où
 * l'alias ci-dessous. Notre code à nous utilise `~/`.
 */
const IT_TOOLS_SRC = r('./vendor/it-tools/src');

export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\//, replacement: `${r('./src')}/` },
      { find: /^@\//, replacement: `${IT_TOOLS_SRC}/` },
      // mime-types, employé par plusieurs outils d'IT-Tools, lit `path.extname`
      // dès son chargement. Sans polyfill, Vite le remplace par un module vide :
      // avertissement en console, et `lookup()` inutilisable.
      { find: /^path$/, replacement: 'path-browserify' },
    ],
  },

  plugins: [
    // En tête : il doit voir les imports avant toute autre résolution.
    vendorOverrides([{ vendorRoot: IT_TOOLS_SRC, overridesRoot: r('./src/overrides/it-tools') }]),

    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
      strictMessage: false,
      // Nos traductions d'abord, celles d'IT-Tools ensuite : elles fournissent
      // les titres et descriptions anglais des 86 outils, qui servent de repli.
      // Seulement les langues qu'on propose : IT-Tools en livre neuf, qui
      // alourdiraient le bundle principal pour rien.
      include: [
        resolve(__dirname, 'src/locales/**'),
        resolve(__dirname, 'vendor/it-tools/locales/{en,fr}.yml'),
      ],
    }),

    // Même jeu d'auto-imports que chez IT-Tools : leurs composants comptent
    // dessus (ref, computed, useStorage, useI18n… sans import explicite).
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
        'vue-i18n',
        { 'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'] },
      ],
      vueTemplate: true,
      dts: 'src/types/auto-imports.d.ts',
    }),

    Icons({ compiler: 'vue3' }),

    vue({ include: [/\.vue$/, /\.md$/] }),
    vueJsx(),
    Markdown({}),
    // Certains outils d'IT-Tools importent leurs icônes en `*.svg?component`.
    svgLoader(),

    // L'ordre des dossiers fait la résolution : nos composants `c-*` passent
    // devant ceux d'IT-Tools, ce qui nous laisse retoucher le design system
    // sans jamais modifier vendor/. src/components n'y figure pas : nos
    // composants s'importent explicitement, et plusieurs portent le même nom
    // qu'un composant d'IT-Tools (ToolCard, FavoriteButton, CommandPalette).
    Components({
      dirs: [r('./src/ui'), IT_TOOLS_SRC],
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      resolvers: [NaiveUiResolver(), IconsResolver({ prefix: 'icon' })],
      dts: 'src/types/components.d.ts',
    }),

    Unocss(),
  ],

  optimizeDeps: {
    // Les outils d'IT-Tools sont chargés à la demande : sans cette liste, Vite
    // ne découvre leurs dépendances qu'à la première ouverture de chaque outil,
    // ré-optimise, puis recharge toute la page en plein usage.
    entries: [
      'index.html',
      'src/**/*.vue',
      'vendor/it-tools/src/tools/**/*.vue',
      'vendor/it-tools/src/ui/**/*.vue',
    ],
  },

  server: {
    watch: {
      // Captures de vérification et sources de CyberChef (construites à part) :
      // les surveiller déclencherait des rechargements pendant les tests.
      ignored: ['**/.screenshots/**', '**/vendor/cyberchef/**'],
    },
  },

  define: {
    // Le plugin i18n précompile les traductions en AST, que vue-i18n n'exécute
    // que si ce drapeau est vrai. La v6 du plugin ne le pose plus, car elle vise
    // vue-i18n 10+ où il est toujours actif ; or IT-Tools nous tient en 9.x, qui
    // le met à false par défaut. Sans lui, chaque t() lève « Unexpected return
    // type in composer » et l'application s'affiche vide.
    __INTLIFY_JIT_COMPILATION__: true,
    // Affichée dans le pied de page.
    __APP_VERSION__: JSON.stringify(version),
    __INTLIFY_PROD_DEVTOOLS__: false,
  },

  build: {
    target: 'esnext',
  },
});
