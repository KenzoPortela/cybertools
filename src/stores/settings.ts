import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { type ColorThemeId, DEFAULT_COLOR_THEME } from '~/app/theme';

/**
 * Réglages de l'utilisateur (page Paramètres).
 *
 * Le thème et la langue gardent leurs propres clés (`cybertools:theme`,
 * `locale`) : elles existaient avant cette page, et la langue est partagée avec
 * IT-Tools. Tout le reste vit ici, à plat : une clé ajoutée plus tard reçoit sa
 * valeur par défaut chez qui a déjà des réglages enregistrés.
 */
export interface Settings {
  /** Thème de couleur (l'accent). Lu au chargement par src/app/theme.ts. */
  colorTheme: ColorThemeId;
  /** Rouvrir la dernière recette à l'ouverture de l'atelier, au lieu d'un atelier vide. */
  recipesRestoreLast: boolean;
  /** Recalculer à chaque modification (Recettes et opérations). Sinon, bouton « Exécuter ». */
  autoBake: boolean;
  /** Magic : profondeur détectée automatiquement, ou fixe. */
  magicAutoDepth: boolean;
  /** Magic : profondeur en mode fixe. */
  magicDepth: number;
  /** Magic : mode intensif par défaut. */
  magicIntensive: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  colorTheme: DEFAULT_COLOR_THEME,
  recipesRestoreLast: false,
  autoBake: true,
  magicAutoDepth: true,
  magicDepth: 3,
  magicIntensive: false,
};

export const useSettingsStore = defineStore('settings', () => {
  const settings = useStorage<Settings>('cybertools:settings', { ...DEFAULT_SETTINGS }, undefined, { mergeDefaults: true });

  function reset() {
    settings.value = { ...DEFAULT_SETTINGS };
  }

  return { settings, reset };
});

// --- Données locales ----------------------------------------------------------

/** Clés du stockage local qui appartiennent à l'application. */
function ownKeys() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('cybertools:') || key === 'locale')) keys.push(key);
  }
  return keys.sort();
}

const EXPORT_FORMAT = 'cybertools-settings';

/** Tous les réglages, favoris, récents et la dernière recette, en JSON. */
export function exportLocalData() {
  const data: Record<string, unknown> = {};
  for (const key of ownKeys()) {
    const raw = localStorage.getItem(key);
    try {
      data[key] = JSON.parse(raw ?? 'null');
    }
    catch {
      // useStorage enregistre les chaînes telles quelles (« dark », « fr »).
      data[key] = raw;
    }
  }
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

/**
 * Restaure un export. Seules les clés de l'application sont acceptées : un
 * fichier trafiqué ne peut pas écrire ailleurs dans le stockage.
 */
export function importLocalData(text: string) {
  const parsed = JSON.parse(text) as { format?: string; data?: Record<string, unknown> };
  if (parsed?.format !== EXPORT_FORMAT || typeof parsed.data !== 'object' || !parsed.data) {
    throw new Error('format');
  }
  const entries = Object.entries(parsed.data).filter(([key]) => key.startsWith('cybertools:') || key === 'locale');
  for (const [key, value] of entries) {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return entries.length;
}

/** Efface tout ce que l'application a enregistré dans ce navigateur. */
export function clearLocalData() {
  for (const key of ownKeys()) localStorage.removeItem(key);
}
