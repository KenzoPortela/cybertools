/**
 * Registre de tous les outils, toutes sources confondues.
 *
 * C'est l'unique point d'entrée du reste de l'application : l'accueil, la
 * recherche, la palette, les favoris et le routeur ne savent pas d'où vient un
 * outil, et n'ont pas à le savoir.
 */
import type { CategoryId } from '~/catalog/categories';
import { cyberchefSource, recipeEquivalents } from '~/catalog/sources/cyberchef';
import { itToolsSource } from '~/catalog/sources/it-tools';
import { nativeSource } from '~/catalog/sources/native';
import { OPERATION_KEYWORDS } from '~/catalog/synonyms';
import type { ToolDef } from '~/catalog/tool.types';

function buildRegistry(tools: ToolDef[]) {
  const byId = new Map<string, ToolDef>();
  const bySlug = new Map<string, ToolDef>();
  /** Ancienne URL → slug */
  const aliases = new Map<string, string>();

  // Une collision serait silencieuse sans ces vérifications : le second outil
  // masquerait le premier. Mieux vaut que l'application refuse de démarrer.
  for (const tool of tools) {
    if (byId.has(tool.id)) throw new Error(`[catalogue] identifiant en double : ${tool.id}`);
    if (bySlug.has(tool.slug)) throw new Error(`[catalogue] slug en double : ${tool.slug}`);
    byId.set(tool.id, tool);
    bySlug.set(tool.slug, tool);
  }

  for (const tool of tools) {
    for (const alias of tool.aliases ?? []) {
      const owner = aliases.get(alias);
      if (owner && owner !== tool.slug) {
        throw new Error(`[catalogue] alias ${alias} revendiqué par ${owner} et ${tool.slug}`);
      }
      aliases.set(alias, tool.slug);
    }
  }

  const countByCategory = new Map<CategoryId, number>();
  for (const tool of tools) {
    countByCategory.set(tool.category, (countByCategory.get(tool.category) ?? 0) + 1);
  }

  return { tools, byId, bySlug, aliases, countByCategory };
}

function allTools(): ToolDef[] {
  const itTools = itToolsSource();

  // Doublons : l'outil IT-Tools reste seul au catalogue, et pointe vers son
  // équivalent enchaînable dans les Recettes (arguments vides = valeurs par
  // défaut, appliquées à l'ouverture).
  const equivalents = recipeEquivalents();
  for (const tool of itTools) {
    const ops = equivalents.get(tool.id);
    if (!ops) continue;
    tool.alsoAvailableAs = { kind: 'cc-recipe', recipe: ops.map(op => ({ op, args: [] })) };
    // Qui cherche le nom CyberChef (« URL Decode ») ou un de ses synonymes
    // (« sha256 ») doit trouver l'outil qui le remplace au catalogue.
    tool.keywords = [...tool.keywords, ...ops, ...ops.flatMap(op => OPERATION_KEYWORDS[op] ?? [])];
  }

  const native = nativeSource();
  const taken = new Set([...native, ...itTools].map(tool => tool.slug));
  return [...native, ...itTools, ...cyberchefSource(taken)];
}

export const registry = buildRegistry(allTools());
