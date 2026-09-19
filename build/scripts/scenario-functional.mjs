/**
 * Vérifie qu'un échantillon d'outils d'IT-Tools calcule juste : une entrée
 * connue, une sortie attendue exacte. Complète le balayage de rendu, qui ne dit
 * pas si un outil fonctionne, seulement s'il s'affiche.
 *
 * usage : node build/scripts/scenario-functional.mjs [--base http://localhost:5173]
 *         puis : npm run screenshot -- build/scenarios/functional.json
 */
import { writeFileSync } from 'node:fs';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'http://localhost:5173';

/**
 * Attend que l'outil soit prêt (10 s au plus) avant d'agir : une attente fixe
 * échoue au hasard dès que la machine est un peu chargée.
 */
const WAIT_FOR_TOOL = `
    for (const started = performance.now(); performance.now() - started < 10000;) {
      if (!document.querySelector('.tool-state[role=status]') && document.querySelector('.tool-content')?.children.length) break;
      await new Promise(r => setTimeout(r, 50));
    }`;

/**
 * Saisit `input` dans le champ `field` (sélecteur, ou n-ième champ de l'outil),
 * attend, puis cherche `expected` dans tout ce que l'outil affiche : valeurs des
 * champs et texte. Renvoie true, ou un extrait de ce qui a été vu.
 */
function typeAndExpect({ input, expected, field = 0, wait = 700 }) {
  return `(async () => {${WAIT_FOR_TOOL}
    const root = document.querySelector('.tool-content');
    const fields = [...root.querySelectorAll('textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=color])')];
    const target = ${typeof field === 'number' ? `fields[${field}]` : `root.querySelector(${JSON.stringify(field)})`};
    if (!target) return 'champ introuvable';
    target.focus();
    target.value = ${JSON.stringify(input)};
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, ${wait}));
    const seen = [...root.querySelectorAll('textarea, input')].map(e => e.value).join(' ⏐ ') + ' ⏐ ' + root.innerText;
    return seen.includes(${JSON.stringify(expected)}) || ('attendu ' + ${JSON.stringify(expected)} + ', vu : ' + seen.replace(/\\s+/g, ' ').slice(0, 200));
  })()`;
}

/** Attend qu'un élément apparaisse (outil prêt, puis 5 s au plus). */
const presence = (selector, label) => `(async () => {${WAIT_FOR_TOOL}
    for (const started = performance.now(); performance.now() - started < 5000;) {
      if (document.querySelector(${JSON.stringify(selector)})) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    return ${JSON.stringify(`${label} absent`)};
  })()`;

const cases = [
  ['base64-string-converter', typeAndExpect({ input: 'Bonjour CyberTools', expected: 'Qm9uam91ciBDeWJlclRvb2xz' })],
  ['hash-text', typeAndExpect({ input: 'abc', expected: '900150983cd24fb0d6963f7d28e17f72' })],
  ['url-encoder', typeAndExpect({ input: 'a b&c', expected: 'a%20b%26c' })],
  ['html-entities', typeAndExpect({ input: '<a>', expected: '&lt;a&gt;' })],
  ['base-converter', typeAndExpect({ input: '255', expected: 'ff' })],
  ['roman-numeral-converter', typeAndExpect({ input: '2024', expected: 'MMXXIV' })],
  ['yaml-to-json-converter', typeAndExpect({ input: 'a: 1', expected: '"a": 1' })],
  ['json-minify', typeAndExpect({ input: '{ "a" : [ 1 , 2 ] }', expected: '{"a":[1,2]}' })],
  ['case-converter', typeAndExpect({ input: 'hello world', expected: 'helloWorld' })],
  ['math-evaluator', typeAndExpect({ input: '2*21', expected: '42' })],
  ['text-to-nato-alphabet', typeAndExpect({ input: 'abc', expected: 'Alpha Bravo Charlie' })],
  ['slugify-string', typeAndExpect({ input: 'Élève à Noël !', expected: 'eleve-a-noel' })],
  ['jwt-parser', `(async () => {${WAIT_FOR_TOOL}
    return document.querySelector('.tool-content').innerText.includes('John Doe') || 'John Doe absent';
  })()`],
  ['uuid-generator', `(async () => {${WAIT_FOR_TOOL}
    const values = [...document.querySelectorAll('.tool-content textarea, .tool-content input')].map(e => e.value).join(' ');
    return /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.test(values) || 'aucun UUID v4';
  })()`],
  ['bcrypt', typeAndExpect({ input: 'motdepasse', expected: '$2a$10$', wait: 1500 })],
  ['text-diff', presence('.monaco-diff-editor', 'éditeur de différences Monaco')],
  ['qrcode-generator', presence('.tool-content img[src^="data:image"]', 'image du QR code')],
];

const jobs = cases.map(([slug, script]) => ({
  name: `fonctionnel-${slug}`,
  url: `${base}/tools/${slug}`,
  scheme: 'light',
  wait: 200,
  script,
}));

writeFileSync('build/scenarios/functional.json', `${JSON.stringify(jobs, null, 2)}\n`);
console.log(`${jobs.length} vérifications → build/scenarios/functional.json`);
