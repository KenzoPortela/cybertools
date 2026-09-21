import type { Component } from 'vue';
import type { CategoryId } from '~/catalog/categories';

export type ToolSource = 'it-tools' | 'cyberchef' | 'native';

/** Configuration de recette au format CyberChef, échangeable avec cyberchef.org. */
export interface RecipeStep {
  op: string;
  args: unknown[];
  disabled?: boolean;
  breakpoint?: boolean;
}

/**
 * Comment l'outil se rend. Trois formes seulement, et c'est ce qui permet de
 * traiter un composant Vue d'IT-Tools et une opération CyberChef exactement de
 * la même manière partout ailleurs : recherche, favoris, palette, catégories.
 */
export type ToolRenderer =
  /** Un composant Vue chargé à la demande — outils d'IT-Tools et outils natifs. */
  | { kind: 'vue'; component: () => Promise<Component> }
  /** Une opération CyberChef isolée, dont le formulaire est généré depuis sa config. */
  | { kind: 'cc-op'; op: string }
  /** Un enchaînement d'opérations CyberChef préréglé. */
  | { kind: 'cc-recipe'; recipe: RecipeStep[] };

/**
 * Un texte traduisible. Les clés sont essayées dans l'ordre et la première qui
 * existe dans la langue courante (ou dans la langue de repli) l'emporte ; à
 * défaut, `fallback`, le libellé brut de la source.
 *
 * Typiquement : notre clé `app.tools.<id>.title`, puis celle de la source
 * (`tools.<id>.title` chez IT-Tools), puis le nom amont.
 */
export interface LocalizedText {
  keys: string[];
  fallback: string;
}

export interface ToolDef {
  /** Identifiant stable, indépendant de la source. Clé des favoris et des récents. */
  id: string;
  /** Segment d'URL, sous /tools/. */
  slug: string;
  source: ToolSource;

  title: LocalizedText;
  description: LocalizedText;

  category: CategoryId;
  /** Mots-clés de recherche, dans n'importe quelle langue. */
  keywords: string[];
  icon?: Component;

  renderer: ToolRenderer;
  /**
   * Mise en page, hors de la grille de cartes de 600 px d'IT-Tools :
   *  - `wide` : toute la largeur de la page (Magic ; les opérations CyberChef
   *    l'ont d'office) ;
   *  - `full` : tout l'écran, sans largeur de page — l'atelier et le Stego Lab,
   *    qui sont des espaces de travail plus que des pages.
   */
  layout?: 'wide' | 'full';

  /** Anciennes URL (celles d'IT-Tools notamment), redirigées vers /tools/<slug>. */
  aliases?: string[];
  /**
   * Équivalent enchaînable dans les Recettes. Règle retenue pour les doublons :
   * quand une même fonction existe des deux côtés, la version IT-Tools est
   * canonique et pointe vers son équivalent CyberChef.
   */
  alsoAvailableAs?: ToolRenderer;

  /** Date d'ajout amont, quand elle est connue. */
  createdAt?: Date;
  /** Renseigné quand un outil est connu pour ne pas fonctionner, avec la raison. */
  unavailable?: string;
}

/** Un outil prêt à afficher : textes résolus dans la langue courante. */
export interface LocalizedTool extends ToolDef {
  localizedTitle: string;
  localizedDescription: string;
  localizedCategory: string;
}
