/**
 * Outils propres à cybertools, construits sur le moteur de CyberChef : l'atelier
 * de recettes et Magic.
 */
import IconMagic from '~icons/mdi/auto-fix';
import IconChefHat from '~icons/mdi/chef-hat';
import IconStego from '~icons/mdi/image-search-outline';
import type { ToolDef } from '~/catalog/tool.types';

export function nativeSource(): ToolDef[] {
  return [
    {
      id: 'recipes',
      slug: 'recipes',
      source: 'native',
      title: { keys: ['app.native.recipes.title'], fallback: 'Recipes' },
      description: { keys: ['app.native.recipes.description'], fallback: 'Chain CyberChef operations.' },
      category: 'misc',
      keywords: ['recipe', 'recette', 'cyberchef', 'chain', 'enchaîner', 'pipeline', 'bake', 'workbench', 'atelier'],
      icon: IconChefHat,
      renderer: { kind: 'vue', component: () => import('~/integrations/cyberchef/components/RecipeWorkbench.vue') },
      layout: 'wide',
      aliases: ['/recettes', '/recipes'],
    },
    {
      id: 'magic',
      slug: 'magic',
      source: 'native',
      title: { keys: ['app.native.magic.title'], fallback: 'Magic' },
      description: { keys: ['app.native.magic.description'], fallback: 'Detect how data is encoded.' },
      category: 'encoding',
      keywords: ['magic', 'detect', 'détecter', 'detection', 'décoder', 'decode', 'identifier', 'encodage', 'encoding', 'inconnu', 'unknown'],
      icon: IconMagic,
      renderer: { kind: 'vue', component: () => import('~/integrations/cyberchef/components/MagicTool.vue') },
      layout: 'wide',
      aliases: ['/magic'],
    },
    {
      id: 'stego-lab',
      slug: 'stego-lab',
      source: 'native',
      title: { keys: ['app.native.stegoLab.title'], fallback: 'Stego Lab' },
      description: { keys: ['app.native.stegoLab.description'], fallback: 'Inspect an image for hidden data — nothing is uploaded.' },
      category: 'forensics',
      keywords: ['steganography', 'stego', 'aperisolve', 'stegsolve', 'zsteg', 'exif', 'metadata', 'lsb', 'bit plane', 'ela', 'forensics', 'stégano', 'stéganographie', 'métadonnées', 'image cachée', 'dissimulation'],
      icon: IconStego,
      renderer: { kind: 'vue', component: () => import('~/integrations/stego/StegoLab.vue') },
      layout: 'wide',
      aliases: ['/steg', '/steganography', '/aperisolve'],
    },
  ];
}
