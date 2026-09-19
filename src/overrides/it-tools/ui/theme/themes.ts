/**
 * Surcharge de vendor/it-tools/src/ui/theme/themes.ts
 * @upstream-sha256 501e06c81bc2a387267e9afe0cd323765c0faa861cd366a6e20b05e5982aabb9
 *
 * Tous les composants `c-*` d'IT-Tools tirent leurs couleurs de ce fichier. En le
 * remplaçant, on réaligne l'ensemble de leur kit sur notre palette — et donc les
 * 86 outils qui l'utilisent — sans modifier une ligne de vendor/.
 *
 * La forme de l'export doit rester identique à celle de l'original.
 */
import { defineThemes } from '@/ui/theme/theme.models';
import { type ThemeTokens, palette } from '~/app/theme';

function toAppTheme(t: ThemeTokens) {
  const tone = ({ color, hover, pressed, faded }: ThemeTokens['primary']) => ({
    color,
    colorHover: hover,
    colorPressed: pressed,
    colorFaded: faded,
  });

  return {
    // Chez eux, `background` désigne le fond des éléments, pas celui de la page.
    background: t.surface,
    text: {
      baseColor: t.text,
      mutedColor: t.textMuted,
    },
    default: {
      color: t.neutral.color,
      colorHover: t.neutral.hover,
      colorPressed: t.neutral.pressed,
    },
    primary: tone(t.primary),
    warning: tone(t.warning),
    success: tone(t.success),
    error: tone(t.error),
  };
}

export const { themes: appThemes, useTheme: useAppTheme } = defineThemes({
  light: toAppTheme(palette.light),
  dark: toAppTheme(palette.dark),
});
