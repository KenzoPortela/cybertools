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

  /** Plan 0 : le châssis (rail, barre d'état), sous le contenu. */
  chassis: string;
  background: string;
  surface: string;
  /**
   * Panneau actif, au-dessus des autres. En clair, les deux surfaces sont
   * blanches : c'est le filet qui les sépare, pas le fond.
   */
  surfaceRaised: string;
  /** Surface au-dessus d'une surface : survol d'option, menu ouvert. */
  elevated: string;
  border: string;
  /** Séparation marquée : bord d'un panneau actif, limite de colonne. */
  borderStrong: string;
  inputBackground: string;
  inputBorder: string;

  text: string;
  textMuted: string;
  /** Étiquettes de 10–11 px : le palier le plus pâle encore lisible à 4,5:1. */
  textFaint: string;
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

/**
 * Gris légèrement teintés : chaque thème a les siens, pour que l'accent s'y fonde.
 *
 * La famille `green` est la référence — c'est elle qui a été dessinée, du plan 0
 * (`chassis`) au texte le plus pâle (`textFaint`). Les deux autres en sont
 * dérivées : on garde la luminosité et la saturation de chaque palier, on ne
 * tourne que la teinte (green ≈ 150°, indigo 236°, graphite 220°). Une seule
 * rampe à maintenir, et les cinq thèmes gardent le même rendu de densité.
 *
 * Tout couple texte/fond est vérifié à 4,5:1 : le cas le plus serré est
 * `textFaint` sur `elevated`, à 4,6:1. C'est lui qui fixe le palier — d'où les
 * deux gris de texte remontés en indigo et en graphite, où le bleu porte moins
 * de luminance que le vert.
 */
const NEUTRALS: Record<'green' | 'indigo' | 'graphite', Record<'light' | 'dark', Neutrals>> = {
  green: {
    light: {
      chassis: '#edf2ef', background: '#f7f9f8', surface: '#ffffff', surfaceRaised: '#ffffff',
      elevated: '#eaf0ed', border: '#e2e8e5', borderStrong: '#d2dcd7',
      inputBackground: '#ffffff', inputBorder: '#d2dcd7',
      text: '#0f1613', textMuted: '#4a5651', textFaint: '#5d6a64',
      shadow: 'rgba(16, 32, 24, 0.08) 0px 8px 24px',
    },
    dark: {
      chassis: '#070a09', background: '#0b0f0d', surface: '#0e1312', surfaceRaised: '#111614',
      elevated: '#161d1a', border: '#1c2421', borderStrong: '#28322e',
      inputBackground: '#0b0f0d', inputBorder: '#28322e',
      text: '#e4ebe7', textMuted: '#97a59e', textFaint: '#7c8b84',
      shadow: 'rgba(0, 0, 0, 0.45) 0px 8px 24px',
    },
  },
  indigo: {
    light: {
      chassis: '#ededf2', background: '#f7f7f9', surface: '#ffffff', surfaceRaised: '#ffffff',
      elevated: '#eaeaf0', border: '#e2e2e8', borderStrong: '#d2d3dc',
      inputBackground: '#ffffff', inputBorder: '#d2d3dc',
      text: '#0f0f16', textMuted: '#4a4b56', textFaint: '#5d5e6a',
      shadow: 'rgba(31, 34, 48, 0.08) 0px 8px 24px',
    },
    dark: {
      chassis: '#07070a', background: '#0b0b0f', surface: '#0e0e13', surfaceRaised: '#111116',
      elevated: '#16161d', border: '#1c1d24', borderStrong: '#282932',
      inputBackground: '#0b0b0f', inputBorder: '#282932',
      text: '#e4e4eb', textMuted: '#9798a5', textFaint: '#7f808d',
      shadow: 'rgba(0, 0, 0, 0.45) 0px 8px 24px',
    },
  },
  graphite: {
    light: {
      chassis: '#edeff2', background: '#f7f8f9', surface: '#ffffff', surfaceRaised: '#ffffff',
      elevated: '#eaecf0', border: '#e2e4e8', borderStrong: '#d2d5dc',
      inputBackground: '#ffffff', inputBorder: '#d2d5dc',
      text: '#0f1116', textMuted: '#4a4e56', textFaint: '#5d616a',
      shadow: 'rgba(20, 24, 32, 0.08) 0px 8px 24px',
    },
    dark: {
      chassis: '#07080a', background: '#0b0c0f', surface: '#0e1013', surfaceRaised: '#111316',
      elevated: '#16181d', border: '#1c1f24', borderStrong: '#282b32',
      inputBackground: '#0b0c0f', inputBorder: '#282b32',
      text: '#e4e6eb', textMuted: '#979ca5', textFaint: '#7d828b',
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
 * Un palier d'arrondi par taille d'objet. Un seul rayon de 12 px arrondissait
 * les pastilles de 22 px en galets et amollissait les grands panneaux.
 *
 * `base`, `small`, `medium` et `large` restent comme alias des nouveaux paliers :
 * les 34 usages de `var(--ct-radius)` et les surcharges naive-ui continuent de
 * fonctionner, et le code neuf nomme directement le palier qu'il veut.
 */
export const radii = {
  /** Touche clavier, case à cocher, pastille de numéro. */
  micro: '4px',
  /** Bouton, champ, onglet, ligne de liste. */
  control: '6px',
  /** Carte, panneau, bloc. */
  panel: '10px',
  /** Palette, modale, menu — ce qui flotte au-dessus du reste. */
  float: '14px',
  /** Interrupteur, barre de recherche ronde. */
  pill: '999px',

  // Alias historiques. `base` vaut le palier « panneau » : c'est ce que la
  // grande majorité des `var(--ct-radius)` existants encadrent.
  base: '10px',
  small: '6px',
  medium: '10px',
  large: '10px',
};

/**
 * Échelle typographique. Elle plafonne à 20 px : un outil ouvert dix fois par
 * jour n'a pas besoin d'un titre d'affiche.
 *
 * `ui` (13 px) est la base de **notre** châssis et de nos pages. L'intérieur des
 * outils reste à 14 px, la taille pour laquelle les 86 composants d'IT-Tools ont
 * été dessinés — voir `overridesFor()`. Deux échelles cohabitent donc, chacune
 * sur son territoire, la frontière étant le cadre de l'outil.
 */
export const fontSizes = {
  /** 20 / 600 — titre de page. */
  pageTitle: '20px',
  /** 15 / 600 — titre de panneau. */
  panelTitle: '15px',
  /** 13 / 400 — base d'interface. */
  ui: '13px',
  /** 12 / 400 — secondaire, descriptions. */
  secondary: '12px',
  /** 12,5 mono — la donnée elle-même. */
  data: '12.5px',
  /** 10 mono majuscules espacées — étiquettes de section. */
  label: '10px',
};

function overridesFor(t: ThemeTokens): GlobalThemeOverrides {
  return {
    common: {
      fontFamily: fonts.sans,
      fontFamilyMono: fonts.mono,
      // 14 px, et pas les 13 px du châssis : naive-ui habille l'intérieur des
      // outils, dessinés par IT-Tools à cette taille.
      fontSize: '14px',
      borderRadius: radii.control,
      borderRadiusSmall: radii.micro,

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
      borderRadius: radii.panel,
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
    'chassis': t.chassis,
    'background': t.background,
    'surface': t.surface,
    'surface-raised': t.surfaceRaised,
    'elevated': t.elevated,
    'border': t.border,
    'border-strong': t.borderStrong,
    'input-background': t.inputBackground,
    'input-border': t.inputBorder,
    'text': t.text,
    'text-muted': t.textMuted,
    'text-faint': t.textFaint,
    'shadow': t.shadow,
    'font-sans': fonts.sans,
    'font-mono': fonts.mono,

    'radius-micro': radii.micro,
    'radius-control': radii.control,
    'radius-panel': radii.panel,
    'radius-float': radii.float,
    'radius-pill': radii.pill,
    // Alias : `--ct-radius` reste le rayon de panneau, `--ct-radius-small` celui
    // d'un contrôle.
    'radius': radii.base,
    'radius-small': radii.small,
    'radius-medium': radii.medium,
    'radius-large': radii.large,

    'font-size-page-title': fontSizes.pageTitle,
    'font-size-panel-title': fontSizes.panelTitle,
    'font-size-ui': fontSizes.ui,
    'font-size-secondary': fontSizes.secondary,
    'font-size-data': fontSizes.data,
    'font-size-label': fontSizes.label,
  };

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(`--ct-${name}`, value);
  }
}
