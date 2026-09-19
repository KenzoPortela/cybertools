/**
 * Prépare vendor/ : clone CyberChef et IT-Tools s'ils sont absents, puis génère
 * les fichiers de configuration que CyberChef produit à la construction.
 *
 * Les sources amont ne sont JAMAIS modifiées. Tout ce que ce script écrit dans
 * vendor/cyberchef (OperationConfig.json, operations/index.mjs, config/modules/*,
 * lib/HTMLEntities.mjs, node_modules) figure déjà dans leur .gitignore : après
 * exécution, `git status` reste vide dans les deux dépôts.
 *
 * Les révisions amont sont figées dans vendor.lock.json : une construction
 * (en local comme dans Docker) utilise toujours exactement les sources testées.
 *
 * Usage : npm run vendor:setup [-- --update]
 *   --update  passe chaque dépôt à la dernière révision amont, met à jour
 *             vendor.lock.json, puis régénère
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vendor = resolve(root, "vendor");
const lockPath = resolve(root, "vendor.lock.json");
const update = process.argv.includes("--update");

const lock = JSON.parse(readFileSync(lockPath, "utf8"));

function run(cmd, args, cwd) {
  // Sous Windows, npm est un script .cmd, qui ne se lance qu'à travers le shell.
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" && cmd === "npm" });
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

/** Dépôts dont la révision vient de changer : leurs dépendances sont à réinstaller. */
const changed = new Set();

/** Amène le dépôt sur une révision précise, sans historique superflu. */
function checkout(path, ref) {
  changed.add(path);
  run("git", ["fetch", "--depth", "1", "origin", ref], path);
  run("git", ["-c", "advice.detachedHead=false", "checkout", "--detach", "FETCH_HEAD"], path);
}

for (const [dir, source] of Object.entries(lock)) {
  const path = resolve(vendor, dir);
  if (!existsSync(path)) {
    step(`Clonage de ${dir} @ ${source.commit.slice(0, 10)}`);
    mkdirSync(path, { recursive: true });
    run("git", ["init", "--quiet"], path);
    run("git", ["remote", "add", "origin", source.url], path);
    checkout(path, source.commit);
  }
  else if (update) {
    step(`Mise à jour de ${dir}`);
    // HEAD distant : la branche par défaut du dépôt, quel que soit son nom.
    checkout(path, "HEAD");
    const commit = git(["rev-parse", "HEAD"], path);
    console.log(commit === source.commit ? "  · déjà à jour" : `  ✓ ${source.commit.slice(0, 10)} → ${commit.slice(0, 10)}`);
    source.commit = commit;
  }
  else if (git(["rev-parse", "HEAD"], path) !== source.commit) {
    step(`${dir} : retour à la révision de vendor.lock.json (${source.commit.slice(0, 10)})`);
    checkout(path, source.commit);
  }
  else {
    console.log(`  · ${dir} déjà présent @ ${source.commit.slice(0, 10)}`);
  }
}

if (update) {
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

// --- CyberChef : dépendances puis génération de la configuration ---------------
//
// L'ordre compte et reprend celui de leur Gruntfile : OperationConfig.json doit
// exister (même vide) avant de générer la config, parce que les opérations de
// contrôle de flux importent Recipe.mjs, qui l'importe à son tour.

const cyberchef = resolve(vendor, "cyberchef");

if (!existsSync(resolve(cyberchef, "node_modules")) || changed.has(cyberchef)) {
  step("Installation des dépendances de CyberChef");
  // --ignore-scripts : leur postinstall passe par Grunt, qu'on appelle nous-mêmes
  // juste après. L'installation complète est nécessaire : terser est déclaré en
  // devDependencies alors qu'une opération du cœur (JavaScriptMinify) l'importe.
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], cyberchef);
}

step("Correctif crypto-api (postinstall amont)");
run("node", ["src/core/config/scripts/fixCryptoApiImports.mjs"], cyberchef);

step("Génération de la configuration CyberChef");
writeFileSync(resolve(cyberchef, "src/core/config/OperationConfig.json"), "[]\n");
run("node", ["src/core/config/scripts/generateHTMLEntities.mjs"], cyberchef);
run("node", ["src/core/config/scripts/generateOpsIndex.mjs"], cyberchef);
run("node", ["src/core/config/scripts/generateConfig.mjs"], cyberchef);

const opCount = Object.keys(
  JSON.parse(readFileSync(resolve(cyberchef, "src/core/config/OperationConfig.json"), "utf8")),
).length;

console.log(`\n  ✓ vendor prêt — ${opCount} opérations CyberChef indexées`);
console.log(`  · pense à lancer : npm run vendor:sync-deps && npm install\n`);
