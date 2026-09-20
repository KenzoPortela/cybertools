import {
  defineConfig,
  presetAttributify,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import { presetScrollbar } from 'unocss-preset-scrollbar';

/**
 * Les presets et les raccourcis reprennent ceux d'IT-Tools : leurs composants
 * d'outils écrivent `bg-surface`, `pretty-scrollbar` ou `divider` directement
 * dans leurs templates, et on les consomme sans les modifier. Les couleurs, en
 * revanche, sont les nôtres.
 */
export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify({ ignoreAttributes: ['size'] }),
    presetTypography(),
    presetScrollbar(),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],

  // UnoCSS ne voit que les fichiers qu'on lui désigne : vendor/ n'est pas sous
  // src/, il faut donc l'ajouter explicitement au scan.
  content: {
    filesystem: ['src/**/*.{vue,ts,tsx,md}', 'vendor/it-tools/src/**/*.{vue,ts,tsx,md}'],
  },

  // Les couleurs passent par les variables --ct-* posées par src/app/theme.ts :
  // une seule palette, et le basculement clair/sombre sans rien recompiler.
  theme: {
    colors: {
      primary: 'var(--ct-primary)',
    },
  },

  shortcuts: {
    // Repris d'IT-Tools, qui les emploie dans ses templates.
    'pretty-scrollbar':
      'scrollbar scrollbar-rounded scrollbar-thumb-color-gray-300 scrollbar-track-color-gray-100 dark:scrollbar-thumb-color-#424242 dark:scrollbar-track-color-#686868',
    'divider': 'h-1px bg-current op-10',
    'bg-surface': 'bg-[var(--ct-surface)]',
    'bg-background': 'bg-[var(--ct-background)]',

    // Les nôtres : un raccourci par jeton, pour ne pas réécrire
    // `bg-[var(--ct-…)]` à chaque fois.
    'bg-chassis': 'bg-[var(--ct-chassis)]',
    'bg-surface-raised': 'bg-[var(--ct-surface-raised)]',
    'bg-elevated': 'bg-[var(--ct-elevated)]',
    'border-base': 'border-[var(--ct-border)]',
    'border-strong': 'border-[var(--ct-border-strong)]',
    'text-muted': 'text-[var(--ct-text-muted)]',
    'text-faint': 'text-[var(--ct-text-faint)]',

    // Paliers d'arrondi, dans l'ordre des tailles d'objet.
    'rounded-micro': 'rounded-[var(--ct-radius-micro)]',
    'rounded-control': 'rounded-[var(--ct-radius-control)]',
    'rounded-panel': 'rounded-[var(--ct-radius-panel)]',
    'rounded-float': 'rounded-[var(--ct-radius-float)]',
  },
});
