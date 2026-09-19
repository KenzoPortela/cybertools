/**
 * Opérations proposées dans l'atelier de recettes : toutes celles de CyberChef,
 * y compris le contrôle de flux et les doublons d'IT-Tools — seules les
 * opérations écartées (voir EXCLUDED_OPERATIONS) en sont absentes.
 */
import { createSearchIndex } from '~/catalog/search';
import { EXCLUDED_OPERATIONS } from '~/catalog/sources/cyberchef';
import { OPERATION_KEYWORDS } from '~/catalog/synonyms';
import operations from '~/generated/cyberchef-operations.json';

export interface RecipeOperation {
  name: string;
  module: string;
  category: string;
  summary: string;
  flowControl: boolean;
}

export const recipeOperations: RecipeOperation[] = (operations as RecipeOperation[])
  .filter(entry => !(entry.name in EXCLUDED_OPERATIONS));

const byName = new Map(recipeOperations.map(entry => [entry.name, entry]));

export function isRecipeOperation(name: string) {
  return byName.has(name);
}

/** Les favoris par défaut de CyberChef : proposés tant que la recherche est vide. */
const SUGGESTED = [
  'To Base64', 'From Base64', 'To Hex', 'From Hex', 'To Hexdump', 'From Hexdump',
  'URL Decode', 'Regular expression', 'Entropy', 'Fork', 'Magic',
];

const index = createSearchIndex(recipeOperations, entry => [
  { text: entry.name, weight: 3, title: true },
  { text: OPERATION_KEYWORDS[entry.name], weight: 2.5 },
  { text: entry.summary, weight: 1 },
  { text: entry.category, weight: 0.5 },
]);

export function searchOperations(query: string, limit = 25): RecipeOperation[] {
  if (!query.trim()) return SUGGESTED.map(name => byName.get(name)).filter((entry): entry is RecipeOperation => Boolean(entry));
  return index.search(query, limit);
}
