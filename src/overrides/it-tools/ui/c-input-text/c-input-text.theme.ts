/**
 * Surcharge de vendor/it-tools/src/ui/c-input-text/c-input-text.theme.ts
 * @upstream-sha256 bb5dcb75a495b5b346a0c05abbf57bffea4e88a26c94e542c41d5f1672bfafbf
 * L'original code ses couleurs en dur, dont le vert d'IT-Tools au focus en
 * thème sombre. Le liseré de focus, lui, vient du thème commun.
 */
import { defineThemes } from '@/ui/theme/theme.models';
import { palette } from '~/app/theme';

export const { useTheme } = defineThemes({
  dark: {
    backgroundColor: palette.dark.inputBackground,
    borderColor: palette.dark.inputBorder,

    focus: {
      backgroundColor: palette.dark.inputBackground,
    },
  },
  light: {
    backgroundColor: palette.light.inputBackground,
    borderColor: palette.light.inputBorder,

    focus: {
      backgroundColor: palette.light.inputBackground,
    },
  },
});
