/**
 * Vérifie que des opérations CyberChef calculent juste, dans le navigateur,
 * via le worker : une entrée connue, éventuellement des arguments, une sortie
 * attendue exacte.
 *
 * L'échantillon vise les cas à risque : modules chargés à la demande, opérations
 * WebAssembly (Argon2, Bzip2, Jq, YARA, désassembleur ARM), sorties binaires et
 * HTML, préremplissage d'arguments.
 *
 * usage : node build/scripts/scenario-cyberchef.mjs [--base http://localhost:5173]
 *         puis : npm run screenshot -- build/scenarios/cyberchef.json
 */
import { writeFileSync } from 'node:fs';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'http://localhost:5173';

/**
 * @param {object} c
 * @param {string} [c.input]        texte saisi dans l'entrée
 * @param {Record<number,string>} [c.args] arguments texte à remplir, par index
 * @param {string} [c.expect]       texte attendu dans la sortie
 * @param {'html'|'binary'} [c.kind] type de sortie attendu
 * @param {string} [c.check]        expression JS libre, évaluée une fois le formulaire prêt
 */
function scenario({ input = '', args = {}, expect, kind, check }) {
  return `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const until = async (test, timeout) => {
      for (const started = performance.now(); performance.now() - started < timeout;) {
        const value = test();
        if (value) return value;
        await sleep(100);
      }
      return null;
    };
    const set = (element, value) => {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };

    if (!await until(() => document.querySelector('.cc-op .io'), 15000)) return 'formulaire absent';
    ${check ? `return (${check});` : ''}

    const fields = [...document.querySelectorAll('.cc-op .params-grid > .field')];
    set(document.querySelector('.cc-op .io textarea'), ${JSON.stringify(input)});
    for (const [index, value] of Object.entries(${JSON.stringify(args)})) {
      const control = fields[index]?.querySelector('textarea, input');
      if (!control) return 'argument ' + index + ' introuvable';
      set(control, value);
    }
    await sleep(400);

    // Premier état stable, une fois le calcul terminé : une erreur, du HTML, ou
    // une sortie texte non vide. Sans attendre la fin du calcul, on risquerait de
    // lire le résultat d'une frappe précédente.
    const outcome = await until(() => {
      if (document.querySelector('.cc-op [aria-busy="true"]')) return null;
      const error = document.querySelector('.cc-op .op-error');
      if (error) return { error: error.innerText.trim().slice(0, 200) };
      const html = document.querySelector('.cc-op .html-output');
      if (html) return { html: html.innerHTML };
      const out = document.querySelectorAll('.cc-op .io textarea')[1]?.value;
      if (out) return { text: out, binary: !!document.querySelector('.cc-op .binary-notice') };
      return null;
    }, 30000);

    if (!outcome) return 'aucune sortie en 30 s';
    if (outcome.error) return 'erreur : ' + outcome.error;
    ${kind === 'html' ? `return !!outcome.html || 'sortie HTML attendue';` : ''}
    ${kind === 'binary' ? `if (!outcome.binary) return 'sortie binaire attendue, vu : ' + outcome.text.slice(0, 80);` : ''}
    ${expect ? `return outcome.text?.includes(${JSON.stringify(expect)}) || ('attendu ' + ${JSON.stringify(expect)} + ', vu : ' + (outcome.text ?? outcome.html ?? '').slice(0, 160));` : 'return true;'}
  })()`;
}

const cases = [
  // Module Default
  ['to-hex', { input: 'abc', expect: '61 62 63' }],
  ['from-hex', { input: '61 62 63', expect: 'abc' }],
  ['rot13', { input: 'Hello', expect: 'Uryyb' }],
  ['to-base32', { input: 'abc', expect: 'MFRGG===' }],
  // Modules chargés à la demande
  ['md4', { input: 'abc', expect: 'a448017aaf21d8525fc10ae87aa6729d' }],
  ['whirlpool', { input: 'abc', expect: '4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5' }],
  ['vigenere-encode', { input: 'hello', args: { 0: 'key' }, expect: 'rijvs' }],
  ['gzip', { input: 'hello hello hello', kind: 'binary' }],
  // WebAssembly
  ['bzip2-compress', { input: 'hello hello hello', expect: 'BZh' }],
  ['argon2', { input: 'abc', expect: '$argon2' }],
  ['jq', { input: '{"a":42}', args: { 0: '.a' }, expect: '42' }],
  ['yara-rules', { input: 'hello world', args: { 0: 'rule salut { strings: $a = "hello" condition: $a }' }, expect: 'salut' }],
  ['disassemble-arm', { input: '00 00 a0 e1', expect: 'mov' }],
  ['disassemble-x86', { input: '90', expect: 'NOP' }],
  // Sortie HTML
  ['entropy', { input: 'hello world', kind: 'html' }],
  // Préremplissage : le format d'entrée de DateTime Delta doit être rempli d'office.
  ['datetime-delta', {
    check: `(() => { const value = [...document.querySelectorAll('.cc-op .params-grid > .field')][1]?.querySelector('input')?.value; return !!value || 'format d\\'entrée vide'; })()`,
  }],
];

const jobs = cases.map(([slug, spec]) => ({
  name: `cyberchef-${slug}`,
  url: `${base}/tools/${slug}`,
  scheme: 'light',
  wait: 200,
  script: scenario(spec),
}));

writeFileSync('build/scenarios/cyberchef.json', `${JSON.stringify(jobs, null, 2)}\n`);
console.log(`${jobs.length} vérifications → build/scenarios/cyberchef.json`);
