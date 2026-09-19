/**
 * Surcharge de vendor/it-tools/src/ui/c-card/c-card.theme.ts
 * @upstream-sha256 5b8600cabc9bfadb67672d3df242b09662bdaecfac34e30ebc5e09011779a039
 * L'original code ses couleurs en dur au lieu de passer par le thème commun.
 */
import { defineThemes } from '@/ui/theme/theme.models';
import { palette } from '~/app/theme';

export const { useTheme } = defineThemes({
  dark: {
    backgroundColor: palette.dark.surface,
    borderColor: palette.dark.border,
  },
  light: {
    backgroundColor: palette.light.surface,
    borderColor: palette.light.border,
  },
});
