/**
 * Passe tactile : sur écran tactile émulé, aucune cible de nos écrans ne doit
 * faire moins de 44 px.
 *
 * usage : node build/scripts/scenario-touch.mjs [--base http://localhost:5173]
 *         puis : npm run screenshot -- build/scenarios/touch.json
 *
 * Trois gabarits — téléphone (390), tablette (900, rail en tiroir), grande
 * tablette (1366, rail en colonne et rail de contexte) —, tous en tactile : les
 * règles `@media (hover: none)` s'y appliquent. Chaque page renvoie la liste des
 * cibles trop petites, ou `true`.
 *
 * Hors périmètre : l'intérieur des outils d'IT-Tools et des formulaires
 * CyberChef, dont le plan interdit de retoucher le rendu, et les liens pris dans
 * une phrase (cibles en ligne, WCAG 2.5.8).
 */
import { writeFileSync } from 'node:fs';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'http://localhost:5173';

const audit = prepare => `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1200);
  ${prepare}
  const SELECTOR = 'a[href], button, [role=tab], [role=option], [role=separator][tabindex], [role=switch], summary, input:not([type=hidden]), select';
  // Nos composants à l'intérieur de .tool-content ; le reste y appartient aux outils.
  const OURS = '.workbench-actions, .cc-input .io-head, .cc-output .io-head, .cc-input .io-strip, .ops, .step-head, .pane-head, .drop';
  const foreign = el => Boolean(el.closest('.tool-content')) && !el.closest(OURS);
  const describe = el => {
    const cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 24);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' «' + label + '»';
  };
  // Palette ouverte : seule elle reçoit le doigt, la page derrière est couverte.
  const modal = document.querySelector('.palette');
  const small = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.closest('[inert]') || foreign(el) || (modal && !modal.contains(el))) continue;
    // Lien de ligne : il s'étend sous toute la ligne, c'est elle la cible.
    const target = el.classList.contains('tool-row-link') ? el.closest('.tool-row') : el;
    const r = target.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
    if (el.tagName === 'A' && el.closest('p') && style.display === 'inline') continue;
    const iconOnly = !el.textContent.trim();
    if (r.height < 43.5 || (iconOnly && r.width < 43.5)) small.push(describe(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return small.length ? small : true;
})()`;

const openPalette = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); await sleep(500);
  const field = document.querySelector('.palette input'); field.value = 'hex'; field.dispatchEvent(new Event('input', { bubbles: true })); await sleep(400);`;
const openDrawer = `document.querySelector('.top-bar-menu').click(); await sleep(500);`;

const pages = [
  ['accueil', '/', ''],
  ['categorie', '/categories/crypto', ''],
  ['outil', '/tools/hash-text', ''],
  ['operation', '/tools/to-hex', ''],
  ['atelier', `/tools/recipes#recipe=From_Base64('A-Za-z0-9%2B/%3D',true,false)Gunzip()`, ''],
  ['magic', '/tools/magic', ''],
  ['stego', '/tools/stego-lab', ''],
  ['parametres', '/settings', ''],
  ['a-propos', '/about', ''],
  ['palette', '/', openPalette],
  ['tiroir', '/', openDrawer],
];

const sizes = [
  ['tel', 390, 844],
  ['tab', 900, 1200],
  ['grand', 1366, 1024],
];

const jobs = sizes.flatMap(([size, width, height]) => pages
  // Le tiroir n'existe que sous 1024 px.
  .filter(([name]) => !(name === 'tiroir' && width >= 1024))
  .map(([name, path, prepare]) => ({
    name: `tactile-${size}-${name}`,
    url: `${base}${path}`,
    width,
    height,
    mobile: true,
    scheme: 'dark',
    script: audit(prepare),
  })));

// Au-delà de 1024 px, le rail montre la marque : la barre du haut ne la double pas.
jobs.push({
  name: 'tactile-grand-marque',
  url: `${base}/tools/hash-text`,
  width: 1366,
  height: 1024,
  mobile: true,
  scheme: 'dark',
  script: `getComputedStyle(document.querySelector('.top-bar-brand')).display === 'none'`,
});

writeFileSync('build/scenarios/touch.json', `${JSON.stringify(jobs, null, 2)}\n`);
console.log(`${jobs.length} vérifications → build/scenarios/touch.json`);
