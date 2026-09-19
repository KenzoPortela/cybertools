/**
 * Génère un scénario qui ouvre chaque outil d'IT-Tools et vérifie qu'il se rend.
 *
 * La liste est relue dans vendor/ à chaque exécution : après une mise à jour
 * amont, les nouveaux outils sont testés d'office.
 *
 * usage : node build/scripts/scenario-all-tools.mjs [--mobile] [--dark] [--base http://localhost:5173]
 *         puis : npm run screenshot -- .screenshots/all-tools.json
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const dark = args.includes('--dark');
const base = args[args.indexOf('--base') + 1] && args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:5173';

const toolsDir = resolve('vendor/it-tools/src/tools');
const slugs = readdirSync(toolsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => readFileSync(join(toolsDir, entry.name, 'index.ts'), 'utf8').match(/path:\s*'\/([^']+)'/)?.[1])
  .filter(Boolean)
  .sort();

// Exécuté dans la page. Plutôt qu'une attente fixe — trop courte quand la
// machine est chargée, trop longue le reste du temps — on interroge la page
// jusqu'à ce que l'outil soit prêt, et on note le temps que ça a pris. Au-delà
// de 10 s, l'outil est déclaré bloqué : là, c'est un vrai problème.
const check = `(async () => {
  const started = performance.now();
  const ready = () => !document.querySelector('.tool-state[role=status]')
    && document.querySelector('.tool-content')?.children.length > 0;
  while (!ready() && performance.now() - started < 10000) {
    await new Promise(r => setTimeout(r, 50));
  }
  const content = document.querySelector('.tool-content');
  const failure = document.querySelector('.tool-state[role=alert]');
  return {
    // Du texte, ou au moins un contrôle : certains outils ne sont qu'un champ
    // de saisie, dont le texte d'invite n'apparaît pas dans innerText.
    rendu: !!content && (content.innerText.trim().length > 0
      || !!content.querySelector('input, textarea, select, button, canvas, svg, video')),
    erreur: failure ? failure.innerText.trim().slice(0, 160) : null,
    bloqué: !ready(),
    prêt_ms: Math.round(performance.now()),
    titre: document.querySelector('h1')?.textContent.trim(),
  };
})()`;

const suffix = `${mobile ? '-mobile' : ''}${dark ? '-sombre' : ''}`;
const jobs = slugs.map(slug => ({
  name: `outil-${slug}${suffix}`,
  url: `${base}/tools/${slug}`,
  scheme: dark ? 'dark' : 'light',
  ...(mobile ? { width: 390, height: 844, mobile: true } : {}),
  wait: 200,
  script: check,
}));

mkdirSync('.screenshots', { recursive: true });
const out = `.screenshots/all-tools${suffix}.json`;
writeFileSync(out, JSON.stringify(jobs, null, 2));
console.log(`${jobs.length} outils → ${out}`);
