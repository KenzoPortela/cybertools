/**
 * Construction du worker CyberChef.
 *
 * On part de la configuration webpack de CyberChef elle-même — elle résout déjà
 * une dizaine de particularités de leurs dépendances (polyfills Node, WASM
 * encodé en base64, correctifs imports-loader…), qu'il serait coûteux et fragile
 * de reproduire avec Vite. On n'y ajoute que le strict nécessaire, validé en
 * phase 0 :
 *
 *  1. des expressions régulières qui fonctionnent sous Windows ;
 *  2. le retrait des plugins propres à leur site (CSS, compression) ;
 *  3. nos points d'entrée : le worker, et un fichier par module d'opérations ;
 *  4. l'alias qui ne garde dans le worker que le module « Default » — les 23
 *     autres sont chargés à la demande, comme sur cyberchef.org.
 *
 * Webpack et ses chargeurs viennent de vendor/cyberchef/node_modules : on ne
 * duplique pas leur chaîne de construction dans notre package.json.
 */
const path = require("node:path");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../..");
const VENDOR = path.join(ROOT, "vendor/cyberchef");
const vendorRequire = createRequire(path.join(VENDOR, "package.json"));

const glob = vendorRequire("glob");
const base = vendorRequire("./webpack.config.js");

// 1. Leurs règles codent « / » comme séparateur de chemin : sous Windows, babel
//    traitait alors tout node_modules (et cassait sur l'instruction `with` de
//    chi-squared), et les polices bitmap n'avaient plus de chargeur. « . »
//    accepte les deux séparateurs.
for (const rule of base.module.rules) {
    if (String(rule.exclude) === String(/node_modules\/(?!crypto-api|bootstrap)/)) {
        rule.exclude = /node_modules.(?!crypto-api|bootstrap)/;
    }
    if (String(rule.test) === String(/(\.fnt$|bmfonts\/.+\.png$)/)) {
        rule.test = /(\.fnt$|bmfonts.+\.png$)/;
    }
}

// 2. Plugins de leur site web, sans objet pour un worker.
const plugins = base.plugins.filter(
    plugin => !["CompressionPlugin", "MiniCssExtractPlugin"].includes(plugin.constructor.name),
);

// 3. Le worker, et un point d'entrée par module d'opérations.
const entry = { "chef-worker": path.join(__dirname, "worker-entry.js") };
for (const file of glob.sync("src/core/config/modules/*.mjs", { cwd: VENDOR, absolute: true })) {
    const name = path.basename(file, ".mjs");
    if (name !== "Default" && name !== "OpModules") entry[`modules/${name}`] = file;
}

module.exports = (outputPath) => ({
    ...base,
    plugins,
    mode: "production",
    target: "webworker",
    context: VENDOR,
    entry,
    resolve: {
        ...base.resolve,
        // Notre point d'entrée importe loglevel : il doit trouver la même copie
        // que le cœur de CyberChef, sans quoi le niveau de journalisation réglé
        // d'un côté ne s'appliquerait pas de l'autre.
        modules: [path.join(VENDOR, "node_modules"), "node_modules"],
        alias: {
            ...base.resolve.alias,
            // 4. Seul le module Default dans le worker ; les autres à la demande.
            "./config/modules/OpModules.mjs": "./config/modules/Default.mjs",
        },
    },
    output: {
        ...base.output,
        path: outputPath,
        filename: "[name].js",
    },
    devtool: false,
    performance: { hints: false },
});
