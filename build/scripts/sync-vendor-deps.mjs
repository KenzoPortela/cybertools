/**
 * Recopie les dépendances d'exécution d'IT-Tools dans notre package.json.
 *
 * Pourquoi : les composants d'outils d'IT-Tools sont importés depuis vendor/ mais
 * doivent être résolus depuis NOTRE node_modules. Si on installait les dépendances
 * dans vendor/it-tools, on se retrouverait avec deux instances de Vue, de Pinia et
 * de naive-ui — ce qui casse la réactivité et l'injection de contexte.
 * Un seul node_modules, à la racine : c'est la règle.
 *
 * Usage : npm run vendor:sync-deps [-- --check]
 *   --check  n'écrit rien, sort en erreur si package.json n'est pas à jour
 *            (utile en CI ou après un git pull de vendor/)
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pkgPath = resolve(root, "package.json");
const itToolsPkgPath = resolve(root, "vendor/it-tools/package.json");

/** Dépendances d'IT-Tools qu'on ne reprend délibérément pas. */
const EXCLUDED = {
  "plausible-tracker": "analytique tierce — on ne pistera personne",
  "unplugin-auto-import": "outil de build, listé par erreur en dépendance chez eux",
  "vue-tsc": "outil de build, listé par erreur en dépendance chez eux",
};

/**
 * Versions qu'on impose à la place de celles d'IT-Tools, avec la raison.
 * Ils installent avec pnpm, qui tolère des pairs incohérents ; npm refuse.
 */
const PINNED = {
  "@tiptap/vue-3": {
    // Version exacte, pas de caret : @tiptap/pm est figé à 2.1.6 chez eux, et
    // tout @tiptap/core plus récent exige @tiptap/pm ^2.7.
    range: "2.1.6",
    reason: "aligné sur @tiptap/pm et starter-kit 2.1.6, sinon conflit de pair @tiptap/core",
  },
};

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

let itToolsPkg;
try {
  itToolsPkg = JSON.parse(readFileSync(itToolsPkgPath, "utf8"));
} catch {
  fail(`vendor/it-tools est absent. Lance d'abord : npm run vendor:setup`);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

/**
 * Paquets importés à l'exécution par le code source d'IT-Tools (hors tests et
 * imports de types seuls, effacés à la compilation).
 *
 * Utile parce qu'IT-Tools range parfois en devDependencies un paquet que ses
 * outils importent réellement : `prettier`, par exemple, pour l'éditeur HTML.
 * Chez eux, pnpm l'installe quand même ; chez nous, le build casserait.
 */
function runtimeImports(srcDir) {
  const names = new Set();
  const importRe = /\bimport\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|vue|js|mjs)$/.test(entry.name) || /\.(test|spec|e2e)\./.test(entry.name)) continue;

      for (const [, typeOnly, staticSpec, dynamicSpec] of readFileSync(path, "utf8").matchAll(importRe)) {
        const spec = staticSpec ?? dynamicSpec;
        if (typeOnly || !spec || /^[./~]/.test(spec) || spec.startsWith("@/") || spec.startsWith("virtual:")) continue;
        names.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
      }
    }
  };

  walk(srcDir);
  return names;
}

const imported = runtimeImports(resolve(root, "vendor/it-tools/src"));

// Les dépendances qui nous appartiennent en propre : tout ce qui n'a pas été
// importé depuis vendor lors d'une synchronisation précédente.
const previouslyVendored = pkg.vendorDependencies?.["it-tools"] ?? [];
const own = Object.fromEntries(
  Object.entries(pkg.dependencies ?? {}).filter(([name]) => !previouslyVendored.includes(name)),
);

const vendored = {};
const skipped = [];
const pinned = [];
for (const [name, range] of Object.entries(itToolsPkg.dependencies ?? {})) {
  if (name in EXCLUDED) {
    skipped.push(name);
    continue;
  }
  // Une dépendance qu'on déclare nous-mêmes prime : c'est nous qui choisissons
  // la version quand les deux projets partagent un paquet.
  if (name in own) continue;
  if (name in PINNED) {
    vendored[name] = PINNED[name].range;
    if (PINNED[name].range !== range) pinned.push(`${name} ${range} → ${PINNED[name].range}`);
    continue;
  }
  vendored[name] = range;
}

// Dépendances de développement amont importées à l'exécution : on les promeut.
const promoted = [];
for (const [name, range] of Object.entries(itToolsPkg.devDependencies ?? {})) {
  // Déjà chez nous en devDependencies (plugin de build dont ils importent un
  // module virtuel, comme @intlify/unplugin-vue-i18n) : on garde notre version.
  const ownDev = name in (pkg.devDependencies ?? {});
  if (!imported.has(name) || name in EXCLUDED || name in own || name in vendored || ownDev) continue;
  vendored[name] = PINNED[name]?.range ?? range;
  promoted.push(name);
}

const merged = Object.fromEntries(
  Object.entries({ ...own, ...vendored }).sort(([a], [b]) => a.localeCompare(b)),
);

const next = { ...pkg, dependencies: merged };
next.vendorDependencies = {
  ...pkg.vendorDependencies,
  "it-tools": Object.keys(vendored).sort(),
};

const serialised = `${JSON.stringify(next, null, 2)}\n`;
const current = readFileSync(pkgPath, "utf8");

if (process.argv.includes("--check")) {
  if (serialised !== current) {
    fail("package.json n'est plus aligné sur vendor/it-tools. Lance : npm run vendor:sync-deps");
  }
  console.log(`  ✓ package.json est aligné sur it-tools ${itToolsPkg.version}`);
  process.exit(0);
}

writeFileSync(pkgPath, serialised);

const added = Object.keys(vendored).filter(name => !(name in (pkg.dependencies ?? {})));
const removed = previouslyVendored.filter(name => !(name in vendored));

console.log(`  ✓ ${Object.keys(vendored).length} dépendances reprises d'it-tools ${itToolsPkg.version}`);
if (added.length) console.log(`    + ${added.join(", ")}`);
if (removed.length) console.log(`    - ${removed.join(", ")}`);
if (promoted.length) {
  console.log(`  · promues depuis leurs devDependencies (importées à l'exécution) : ${promoted.join(", ")}`);
}
if (skipped.length) {
  console.log(`  · écartées : ${skipped.map(n => `${n} (${EXCLUDED[n]})`).join(", ")}`);
}
if (pinned.length) {
  console.log(`  · épinglées : ${pinned.join(", ")}`);
  for (const name of Object.keys(PINNED)) {
    if (name in vendored) console.log(`      ${name} — ${PINNED[name].reason}`);
  }
}
if (added.length || removed.length) console.log(`\n  Pense à relancer : npm install\n`);
