import messages from '@intlify/unplugin-vue-i18n/messages';
import { createI18n } from 'vue-i18n';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * L'anglais par défaut : c'est la langue des outils eux-mêmes (CyberChef et
 * IT-Tools écrivent leurs libellés en anglais) et celle du projet. Le français
 * se choisit dans les Paramètres, et le choix est retenu.
 *
 * Pas de détection depuis le navigateur : elle donnerait une interface
 * française par-dessus des outils anglais, sans que l'utilisateur l'ait demandé.
 */
function detectLocale(): SupportedLocale {
  const stored = localStorage.getItem('locale');
  return stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)
    ? (stored as SupportedLocale)
    : DEFAULT_LOCALE;
}

/**
 * Le catalogue fusionne nos traductions et celles d'IT-Tools. Les leurs ne
 * couvrent en pratique que les titres et descriptions anglais de leurs outils :
 * elles servent de repli, `fallbackLocale` s'en charge.
 */
export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages,
  // Une clé manquante n'est pas une anomalie ici : beaucoup de libellés amont
  // n'existent qu'en anglais, et `t(clé, repli)` fait le travail.
  missingWarn: false,
  fallbackWarn: false,
});
