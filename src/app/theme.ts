import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * Jetons de design de cybertools — la source unique des couleurs.
 *
 * Ils alimentent trois consommateurs, pour qu'un outil venu d'IT-Tools et une
 * opération de CyberChef soient rigoureusement identiques à l'œil :
 *  - naive-ui, via les surcharges ci-dessous ;
 *  - le kit `c-*` d'IT-Tools, via src/overrides/it-tools/ui/**, qui remplace
 *    leurs fichiers de thème ;
 *  - notre propre CSS et UnoCSS, via les variables `--ct-*` posées sur <html>.
 */

interface Tone {
  color: string;
  hover: string;
  pressed: string;
  /** Fond teinté léger : badges, boutons secondaires, focus. */
  faded: string;
}

export interface ThemeTokens {
  primary: Tone;
  success: Tone;
  warning: Tone;
  error: Tone;
  /** Boutons neutres : fond presque transparent qui fonce au survol. */
  neutral: { color: string; hover: string; pressed: string };

  background: string;
  surface: string;
  /** Surface au-dessus d'une surface : survol d'option, menu ouvert. */
  elevated: string;
  border: string;
  inputBackground: string;
  inputBorder: string;

  text: string;
  textMuted: string;
  shadow: string;
}

type Neutrals = Omit<ThemeTokens, 'primary' | 'success' | 'warning' | 'error' | 'neutral'>;

/** Couleurs d'état : identiques d'un thème de couleur à l'autre. */
const STATUS = {
  light: {
    success: { color: '#16a34a', hover: '#22c55e', pressed: '#15803d', faded: '#16a34a1f' },
    warning: { color: '#d97706', hover: '#f59e0b', pressed: '#b45309', faded: '#d977061f' },
    error: { color: '#dc2626', hover: '#ef4444', pressed: '#b91c1c', faded: '#dc26261f' },
    neutral: { color: 'rgba(24, 28, 36, 0.05)', hover: 'rgba(24, 28, 36, 0.09)', pressed: 'rgba(24, 28, 36, 0.16)' },
  },
  dark: {
    success: { color: '#4ade80', hover: '#6ee7a0', pressed: '#22c55e', faded: '#4ade8026' },
    warning: { color: '#fbbf24', hover: '#fcd34d', pressed: '#f59e0b', faded: '#fbbf2426' },
    error: { color: '#f87171', hover: '#fa8c8c', pressed: '#ef4444', faded: '#f8717126' },
    neutral: { color: 'rgba(255, 255, 255, 0.06)', hover: 'rgba(255, 255, 255, 0.1)', pressed: 'rgba(255, 255, 255, 0.18)' },
  },
};

/** Gris légèrement teintés : chaque thème a les siens, pour que l'accent s'y fonde. */
const NEUTRALS: Record<'green' | 'indigo' | 'graphite', Record<'light' | 'dark', Neutrals>> = {
  green: {
    light: {
      background: '#f3f6f4', surface: '#ffffff', elevated: '#eaf0ec', border: '#dde5e0',
      inputBackground: '#ffffff', inputBorder: '#d0d9d4', text: '#15201b', textMuted: '#5b6a63',
      shadow: 'rgba(16, 32, 24, 0.08) 0px 8px 24px',
    },
    dark: {
      background: '#0a0e0c', surface: '#101613', elevated: '#18201c', border: '#1e2824',
      inputBackground: '#0d1310', inputBorder: '#26322c', text: '#dce6e0', textMuted: '#84958c',
      shadow: 'rgba(0, 0, 0, 0.45) 0px 8px 24px',
    },
  },
  indigo: {
    light: {
      background: '#f6f7fb', surface: '#ffffff', elevated: '#f1f2f7', border: '#e6e8f0',
      inputBackground: '#ffffff', inputBorder: '#dcdfea', text: '#1f2230', textMuted: '#6b7185',
      shadow: 'rgba(31, 34, 48, 0.08) 0px 8px 24px',
    },
    dark: {
      background: '#131318', surface: '#1b1b22', elevated: '#262630', border: '#2a2a35',
      inputBackground: '#22222b', inputBorder: '#30303c', text: '#e8e9f0', textMuted: '#9296a8',
      shadow: 'rgba(0, 0, 0, 0.35) 0px 8px 24px',
    },
  },
  graphite: {
    light: {
      background: '#f5f6f8', surface: '#ffffff', elevated: '#eef0f3', border: '#e1e4e9',
      inputBackground: '#ffffff', inputBorder: '#d5d9df', text: '#1a1d22', textMuted: '#636974',
      shadow: 'rgba(20, 24, 32, 0.08) 0px 8px 24px',
    },
    dark: {
      background: '#0d0e11', surface: '#14161a', elevated: '#1c1f24', border: '#24272d',
      inputBackground: '#111317', inputBorder: '#2c3037', text: '#e5e7eb', textMuted: '#8e939d',
      shadow: 'rgba(0, 0, 0, 0.45) 0px 8px 24px',
    },
  },
};

export const COLOR_THEME_IDS = ['terminal', 'indigo', 'amber', 'arctic', 'magenta'] as const;
export type ColorThemeId = (typeof COLOR_THEME_IDS)[number];
export const DEFAULT_COLOR_THEME: ColorThemeId = 'terminal';

interface ColorThemeSpec {
  neutrals: keyof typeof NEUTRALS;
  light: Tone;
  dark: Tone;
}

/**
 * Thèmes de couleur : seul l'accent change (et la teinte des gris), jamais les
 * formes. En clair, l'accent est plus sombre pour rester lisible sur blanc.
 */
const COLOR_THEMES: Record<ColorThemeId, ColorThemeSpec> = {
  terminal: {
    neutrals: 'green',
    light: { color: '#0f8a52', hover: '#12a060', pressed: '#0b6e41', faded: '#0f8a521f' },
    dark: { color: '#3dd68c', hover: '#62e0a3', pressed: '#2bb574', faded: '#3dd68c24' },
  },
  indigo: {
    neutrals: 'indigo',
    light: { color: '#4f46e5', hover: '#6366f1', pressed: '#4338ca', faded: '#4f46e51f' },
    dark: { color: '#7c83ff', hover: '#959bff', pressed: '#5f66e6', faded: '#7c83ff26' },
  },
  amber: {
    neutrals: 'graphite',
    light: { color: '#b45309', hover: '#c96a12', pressed: '#92400e', faded: '#b453091f' },
    dark: { color: '#f5a524', hover: '#f7b84f', pressed: '#d98c0a', faded: '#f5a52424' },
  },
  arctic: {
    neutrals: 'graphite',
    light: { color: '#0e7490', hover: '#0f86a6', pressed: '#155e75', faded: '#0e74901f' },
    dark: { color: '#22d3ee', hover: '#52def2', pressed: '#0fb5cf', faded: '#22d3ee24' },
  },
  magenta: {
    neutrals: 'graphite',
    light: { color: '#a21caf', hover: '#b62bc4', pressed: '#86198f', faded: '#a21caf1f' },
    dark: { color: '#e879f9', hover: '#ee97fa', pressed: '#d451ea', faded: '#e879f926' },
  },
};

/** Aperçu de chaque thème (page Paramètres). */
export const colorThemeSwatches = Object.fromEntries(COLOR_THEME_IDS.map(id => [id, {
  light: COLOR_THEMES[id].light.color,
  dark: COLOR_THEMES[id].dark.color,
  background: NEUTRALS[COLOR_THEMES[id].neutrals].dark.background,
}])) as Record<ColorThemeId, { light: string; dark: string; background: string }>;

function tokensFor(id: ColorThemeId, mode: 'light' | 'dark'): ThemeTokens {
  const spec = COLOR_THEMES[id];
  return { ...NEUTRALS[spec.neutrals][mode], ...STATUS[mode], primary: spec[mode] };
}

/**
 * Thème de couleur choisi, lu une fois au chargement. Le kit d'IT-Tools calcule
 * ses couleurs à l'import de ses modules : changer de thème de couleur recharge
 * donc la page (la bascule clair / sombre, elle, reste instantanée).
 */
function storedColorTheme(): ColorThemeId {
  try {
    const stored = JSON.parse(localStorage.getItem('cybertools:settings') ?? '{}')?.colorTheme;
    return (COLOR_THEME_IDS as readonly string[]).includes(stored) ? stored : DEFAULT_COLOR_THEME;
  }
  catch {
    return DEFAULT_COLOR_THEME;
  }
}

export const activeColorTheme = storedColorTheme();

export const palette: Record<'light' | 'dark', ThemeTokens> = {
  light: tokensFor(activeColorTheme, 'light'),
  dark: tokensFor(activeColorTheme, 'dark'),
};

export const fonts = {
  // Polices embarquées avec l'application (@fontsource) : aucune requête vers un
  // serveur tiers, pas même Google Fonts.
  sans: '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace',
};

/**
 * Un seul arrondi pour tout le site ; seules les barres de recherche sont en
 * pilule. Les anciens paliers (small, medium) restent comme alias, pour ne pas
 * réintroduire de valeurs divergentes.
 */
const RADIUS = '12px';

export const radii = {
  base: RADIUS,
  small: RADIUS,
  medium: RADIUS,
  large: RADIUS,
  pill: '999px',
  /** Micro-éléments (touche clavier, case à cocher) : 12 px en ferait des cercles. */
  micro: '4px',
};

function overridesFor(t: ThemeTokens): GlobalThemeOverrides {
  return {
    common: {
      fontFamily: fonts.sans,
      fontFamilyMono: fonts.mono,
      fontSize: '14px',
      borderRadius: radii.base,
      borderRadiusSmall: radii.base,

      primaryColor: t.primary.color,
      primaryColorHover: t.primary.hover,
      primaryColorPressed: t.primary.pressed,
      primaryColorSuppl: t.primary.hover,
      successColor: t.success.color,
      successColorHover: t.success.hover,
      successColorPressed: t.success.pressed,
      successColorSuppl: t.success.hover,
      warningColor: t.warning.color,
      warningColorHover: t.warning.hover,
      warningColorPressed: t.warning.pressed,
      warningColorSuppl: t.warning.hover,
      errorColor: t.error.color,
      errorColorHover: t.error.hover,
      errorColorPressed: t.error.pressed,
      errorColorSuppl: t.error.hover,
      // naive-ui a un bleu « info » à part ; on le rattache à la couleur primaire
      // pour ne pas introduire une cinquième teinte.
      infoColor: t.primary.color,
      infoColorHover: t.primary.hover,
      infoColorPressed: t.primary.pressed,
      infoColorSuppl: t.primary.hover,

      bodyColor: t.background,
      cardColor: t.surface,
      modalColor: t.surface,
      popoverColor: t.surface,
      tableColor: t.surface,
      borderColor: t.border,
      dividerColor: t.border,
      textColorBase: t.text,
      textColor1: t.text,
      textColor2: t.text,
      textColor3: t.textMuted,
    },
    Card: {
      color: t.surface,
      borderColor: t.border,
      borderRadius: radii.large,
    },
    Input: {
      color: t.inputBackground,
      colorFocus: t.inputBackground,
      border: `1px solid ${t.inputBorder}`,
      borderHover: `1px solid ${t.primary.hover}`,
      borderFocus: `1px solid ${t.primary.color}`,
      boxShadowFocus: `0 0 0 3px ${t.primary.faded}`,
    },
    Layout: {
      color: t.background,
      siderColor: t.surface,
      siderBorderColor: t.border,
    },
    Menu: {
      itemHeight: '34px',
    },
    Checkbox: {
      borderRadius: radii.micro,
    },
    Notification: {
      color: t.surface,
    },
    AutoComplete: {
      peers: { InternalSelectMenu: { height: '460px', color: t.surface } },
    },
  };
}

export const lightThemeOverrides = overridesFor(palette.light);
export const darkThemeOverrides = overridesFor(palette.dark);

/**
 * Expose les jetons en variables CSS sur <html>, pour notre CSS et pour les
 * raccourcis UnoCSS (`bg-surface`, `border-base`…).
 */
export function applyCssVariables(t: ThemeTokens, root: HTMLElement = document.documentElement) {
  const vars: Record<string, string> = {
    'primary': t.primary.color,
    'primary-hover': t.primary.hover,
    'primary-pressed': t.primary.pressed,
    'primary-faded': t.primary.faded,
    'success': t.success.color,
    'warning': t.warning.color,
    'error': t.error.color,
    'neutral': t.neutral.color,
    'neutral-hover': t.neutral.hover,
    'background': t.background,
    'surface': t.surface,
    'elevated': t.elevated,
    'border': t.border,
    'input-background': t.inputBackground,
    'input-border': t.inputBorder,
    'text': t.text,
    'text-muted': t.textMuted,
    'shadow': t.shadow,
    'font-sans': fonts.sans,
    'font-mono': fonts.mono,
    'radius': radii.base,
    'radius-small': radii.small,
    'radius-medium': radii.medium,
    'radius-large': radii.large,
    'radius-pill': radii.pill,
    'radius-micro': radii.micro,
  };

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(`--ct-${name}`, value);
  }
}
