/**
 * Vérification de types limitée à notre code.
 *
 * vue-tsc suit les imports : dès qu'on monte un composant d'IT-Tools, il analyse
 * aussi vendor/it-tools, qui contient des dizaines d'erreurs de types chez eux
 * (paquets sans @types, props mal typées…). On ne peut pas les corriger sans
 * modifier vendor/, et elles ne disent rien de la qualité de notre code.
 *
 * Ce script échoue donc sur toute erreur hors de vendor/, et se contente de
 * compter celles de vendor/ — un nombre qui bondit après un git pull amont
 * mérite quand même un coup d'œil.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// On lance le binaire de vue-tsc avec Node directement : passer par npx sous
// Windows exige un shell, ce que Node signale à raison comme risqué.
const vueTsc = createRequire(import.meta.url).resolve("vue-tsc/bin/vue-tsc.js");

const result = spawnSync(process.execPath, [vueTsc, "--noEmit", "--pretty", "false"], {
  encoding: "utf8",
});

const lines = `${result.stdout}${result.stderr}`.split(/\r?\n/);
// Une erreur commence par un chemin suivi de (ligne,colonne) ; les lignes
// suivantes, indentées, en sont la suite.
const errorStart = /^(.+?)\(\d+,\d+\): error TS\d+/;

const ours = [];
let vendorCount = 0;
let current = null;

for (const line of lines) {
  const match = line.match(errorStart);
  if (match) {
    const isVendor = match[1].replace(/\\/g, "/").startsWith("vendor/");
    if (isVendor) {
      vendorCount++;
      current = null;
    } else {
      current = [line];
      ours.push(current);
    }
  } else if (current && line.startsWith(" ")) {
    current.push(line);
  }
}

if (vendorCount > 0) {
  console.log(`  · ${vendorCount} erreurs de types dans vendor/ (code amont, ignorées)`);
}

if (ours.length > 0) {
  console.error(`\n  ✗ ${ours.length} erreur(s) de types dans notre code :\n`);
  for (const block of ours) console.error(block.join("\n"));
  process.exit(1);
}

if (result.status !== 0 && vendorCount === 0) {
  // vue-tsc a échoué sans erreur reconnaissable : on n'avale pas ça.
  console.error(`${result.stdout}${result.stderr}`);
  process.exit(result.status ?? 1);
}

console.log("  ✓ aucune erreur de types dans notre code");
