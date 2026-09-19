/**
 * Construit le moteur CyberChef et l'index de ses opérations.
 *
 *  - public/cyberchef/          le worker et ses modules, servis tels quels ;
 *  - src/generated/cyberchef-operations.json
 *                               un index léger (nom, catégorie amont, résumé)
 *                               que le catalogue embarque. La configuration
 *                               complète des opérations (arguments, description
 *                               HTML), 106 ko gzip, n'est chargée qu'à
 *                               l'ouverture d'une opération.
 *
 * La construction webpack prend environ deux minutes : elle est sautée quand ni
 * la révision de CyberChef ni nos fichiers de construction n'ont changé.
 *
 * usage : npm run cyberchef:build [-- --force]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vendor = join(root, "vendor/cyberchef");
const outDir = join(root, "public/cyberchef");
const indexFile = join(root, "src/generated/cyberchef-operations.json");
const stampFile = join(outDir, "build-stamp.json");
const force = process.argv.includes("--force");

const operationConfigPath = join(vendor, "src/core/config/OperationConfig.json");
if (!existsSync(operationConfigPath) || !existsSync(join(vendor, "node_modules"))) {
  console.error("\n  ✗ vendor/cyberchef n'est pas prêt. Lance d'abord : npm run vendor:setup\n");
  process.exit(1);
}

// --- Empreinte : révision de CyberChef + nos fichiers de construction --------

function stamp() {
  const hash = createHash("sha256");
  hash.update(execFileSync("git", ["rev-parse", "HEAD"], { cwd: vendor, encoding: "utf8" }).trim());
  const inputs = [
    ...readdirSync(join(root, "build/cyberchef")).map(name => join(root, "build/cyberchef", name)),
    fileURLToPath(import.meta.url),
    operationConfigPath,
  ].sort();
  for (const file of inputs) hash.update(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  return hash.digest("hex");
}

const current = stamp();
const previous = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, "utf8")).stamp : null;

// --- Index des opérations (rapide : toujours régénéré) ------------------------

/** Première phrase utile d'une description HTML, en texte brut. */
function summarise(html) {
  const first = String(html ?? "")
    .split(/<br\s*\/?>/i)
    .map(part => part.trim())
    .find(Boolean) ?? "";
  const text = first
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

const operationConfig = JSON.parse(readFileSync(operationConfigPath, "utf8"));
const categories = JSON.parse(readFileSync(join(vendor, "src/core/config/Categories.json"), "utf8"));

// Une opération peut figurer dans plusieurs catégories amont : la première est
// sa catégorie principale.
const upstreamCategory = {};
for (const { name, ops } of categories) {
  for (const op of ops) upstreamCategory[op] ??= name;
}

const index = Object.entries(operationConfig)
  .map(([name, config]) => ({
    name,
    module: config.module,
    category: upstreamCategory[name] ?? "Other",
    summary: summarise(config.description),
    flowControl: Boolean(config.flowControl),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(dirname(indexFile), { recursive: true });
writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
console.log(`  ✓ index : ${index.length} opérations → src/generated/cyberchef-operations.json`);

// --- Worker ---------------------------------------------------------------

if (!force && previous === current && existsSync(join(outDir, "chef-worker.js"))) {
  console.log("  · worker à jour, construction sautée (--force pour reconstruire)");
  process.exit(0);
}

console.log("  ▸ construction du worker CyberChef (environ deux minutes)…");
const started = Date.now();
rmSync(outDir, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const vendorRequire = createRequire(join(vendor, "package.json"));
const webpack = vendorRequire("webpack");
const config = require(join(root, "build/cyberchef/webpack.config.cjs"))(outDir);

const stats = await new Promise((resolvePromise, reject) => {
  webpack(config, (error, result) => (error ? reject(error) : resolvePromise(result)));
});

const info = stats.toJson({ all: false, errors: true, warnings: true, assets: true });
if (info.errors.length > 0) {
  console.error(`\n  ✗ ${info.errors.length} erreur(s) de construction :`);
  for (const error of info.errors.slice(0, 10)) {
    console.error(`    - ${(error.message ?? "").split("\n")[0]} ${error.moduleName ?? ""}`);
  }
  process.exit(1);
}

writeFileSync(stampFile, `${JSON.stringify({ stamp: current, builtAt: new Date().toISOString() }, null, 2)}\n`);

const worker = info.assets.find(asset => asset.name === "chef-worker.js");
const modules = info.assets.filter(asset => asset.name.startsWith("modules/") && asset.name.endsWith(".js"));
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
console.log(`  ✓ worker construit en ${Math.round((Date.now() - started) / 1000)} s : chef-worker.js ${mb(worker.size)}, ${modules.length} modules (${mb(modules.reduce((sum, asset) => sum + asset.size, 0))})`);
