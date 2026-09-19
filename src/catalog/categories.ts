import type { Component } from 'vue';
import IconCalculator from '~icons/mdi/calculator-variant-outline';
import IconCode from '~icons/mdi/code-tags';
import IconDataFormats from '~icons/mdi/code-json';
import IconForensics from '~icons/mdi/magnify-scan';
import IconImage from '~icons/mdi/image-outline';
import IconLock from '~icons/mdi/lock-outline';
import IconNetwork from '~icons/mdi/lan';
import IconText from '~icons/mdi/format-text';
import IconToolbox from '~icons/mdi/toolbox-outline';
import IconWeb from '~icons/mdi/web';

/**
 * Nos catégories à nous. Ni celles de CyberChef (17, très orientées analyse) ni
 * celles d'IT-Tools (10, très orientées développement web) : les deux sources
 * viendront s'y ranger par une table de correspondance, pour que l'utilisateur
 * n'ait jamais à deviner d'où vient un outil.
 */
export const CATEGORY_IDS = [
  'encoding',
  'crypto',
  'network',
  'text',
  'data-formats',
  'web-dev',
  'forensics',
  'media',
  'math',
  'misc',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  /** Clé i18n du libellé, sous `app.categories.`. */
  labelKey: string;
  /** Icône au trait, reprise par les opérations CyberChef de la catégorie. */
  icon: Component;
}

export const categories: Category[] = [
  { id: 'encoding', labelKey: 'app.categories.encoding', icon: IconCode },
  { id: 'crypto', labelKey: 'app.categories.crypto', icon: IconLock },
  { id: 'network', labelKey: 'app.categories.network', icon: IconNetwork },
  { id: 'text', labelKey: 'app.categories.text', icon: IconText },
  { id: 'data-formats', labelKey: 'app.categories.dataFormats', icon: IconDataFormats },
  { id: 'web-dev', labelKey: 'app.categories.webDev', icon: IconWeb },
  { id: 'forensics', labelKey: 'app.categories.forensics', icon: IconForensics },
  { id: 'media', labelKey: 'app.categories.media', icon: IconImage },
  { id: 'math', labelKey: 'app.categories.math', icon: IconCalculator },
  { id: 'misc', labelKey: 'app.categories.misc', icon: IconToolbox },
];

export const categoryById = new Map(categories.map(category => [category.id, category]));
