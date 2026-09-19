/**
 * Surcharge de vendor/it-tools/src/ui/c-select/c-select.theme.ts
 * @upstream-sha256 cded8d8e0622e1795c464281359e3b958a947662e07bc9495f5161c4993ca13e
 * Les tailles sont reprises à l'identique ; seules les couleurs changent.
 */
import { defineThemes } from '@/ui/theme/theme.models';
import { palette } from '~/app/theme';

const sizes = {
  small: {
    height: '28px',
    fontSize: '12px',
  },
  medium: {
    height: '34px',
    fontSize: '14px',
  },
  large: {
    height: '40px',
    fontSize: '16px',
  },
};

export const { useTheme } = defineThemes({
  dark: {
    sizes,

    backgroundColor: palette.dark.inputBackground,
    borderColor: palette.dark.inputBorder,
    dropdownShadow: palette.dark.shadow,

    option: {
      hover: {
        backgroundColor: palette.dark.elevated,
      },
      active: {
        textColor: palette.dark.primary.color,
      },
    },

    focus: {
      backgroundColor: palette.dark.inputBackground,
    },
  },
  light: {
    sizes,

    backgroundColor: palette.light.inputBackground,
    borderColor: palette.light.inputBorder,
    dropdownShadow: palette.light.shadow,

    option: {
      hover: {
        backgroundColor: palette.light.elevated,
      },
      active: {
        textColor: palette.light.primary.color,
      },
    },

    focus: {
      backgroundColor: palette.light.inputBackground,
    },
  },
});
