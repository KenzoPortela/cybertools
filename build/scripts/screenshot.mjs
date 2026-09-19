/**
 * Vérification visuelle et fonctionnelle dans un vrai Chrome, sans dépendance.
 *
 * Pilote Chrome en headless par le protocole DevTools : émulation d'appareil
 * (utile pour le mobile, que les captures en ligne de commande rognent à cause de
 * la largeur minimale de fenêtre), thème clair ou sombre forcé, script exécuté
 * dans la page, et pour chaque page : capture, débordement horizontal, erreurs et
 * avertissements de la console.
 *
 * usage : node build/scripts/screenshot.mjs <scénario.json>
 *   [{ "name": "accueil", "url": "http://localhost:5173/",
 *      "width": 390, "height": 844, "mobile": true, "scheme": "dark",
 *      "fullPage": false, "wait": 1500,
 *      "script": "expression JS, éventuellement async ; sa valeur est affichée" }]
 *
 * Captures dans .screenshots/ (ignoré par git). Chrome est cherché aux
 * emplacements habituels ; CHROME_PATH permet d'en imposer un autre.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';

const outDir = resolve('.screenshots');
mkdirSync(outDir, { recursive: true });

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));

/**
 * Avertissements connus et documentés (build/scenarios/known-warnings.json).
 * Ils restent affichés, avec leur explication, mais sans le « ! » réservé aux
 * problèmes nouveaux — qui, eux, ne doivent pas se perdre dans le bruit.
 */
const knownWarningsPath = resolve('build/scenarios/known-warnings.json');
const knownWarnings = existsSync(knownWarningsPath)
  ? JSON.parse(readFileSync(knownWarningsPath, 'utf8')).map(({ pattern, reason }) => ({ pattern: new RegExp(pattern), reason }))
  : [];
// Port de débogage libre et profil propre à chaque exécution : plusieurs
// scénarios peuvent ainsi tourner en parallèle sans se marcher dessus.
const PORT = await new Promise((resolvePort) => {
  const server = createServer().listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolvePort(port));
  });
});
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find(path => existsSync(path));
if (!chromePath) {
  console.error('Chrome introuvable. Indique son chemin avec CHROME_PATH.');
  process.exit(1);
}

// Profil jetable : on ne touche jamais au profil Chrome de l'utilisateur.
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(tmpdir(), `cybertools-chrome-${PORT}`)}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForBrowser() {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); }
  }
  throw new Error('Chrome ne répond pas');
}

async function run() {
  await waitForBrowser();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach(fn => fn(msg));
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  async function runJob(job) {
    const problems = [];
    const onEvent = (msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        problems.push(`EXCEPTION ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`.slice(0, 300));
      }
      if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
        const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        problems.push(`${msg.params.type.toUpperCase()} ${text}`.slice(0, 300));
      }
    };
    listeners.push(onEvent);

    try {
    const width = job.width ?? 1280;
    const height = job.height ?? 900;
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: job.mobile ? 2 : 1, mobile: !!job.mobile,
    });
    // Sans émulation tactile, un « mobile » garde un pointeur fin et du survol :
    // les règles @media (hover: none) ne s'appliqueraient jamais.
    await send('Emulation.setTouchEmulationEnabled', job.mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: job.scheme ?? 'light' }],
    });

    // Attend la fin du chargement, 60 s au plus : un scénario ne doit jamais
    // pouvoir bloquer toute la série.
    const nextLoad = () => {
      let onLoad;
      let timer;
      const promise = new Promise((resolveLoad, rejectLoad) => {
        onLoad = m => m.method === 'Page.loadEventFired' && resolveLoad();
        timer = setTimeout(() => rejectLoad(new Error('chargement jamais terminé (60 s)')), 60_000);
        listeners.push(onLoad);
      });
      return promise.finally(() => {
        clearTimeout(timer);
        listeners.splice(listeners.indexOf(onLoad), 1);
      });
    };

    let loaded = nextLoad();
    const navigation = await send('Page.navigate', { url: job.url });
    if (!navigation.loaderId) {
      // Même document, seul le fragment change (#…) : le navigateur ne recharge
      // pas et aucun événement de chargement ne viendra. On repart d'une page
      // vide pour que chaque scénario ait un document neuf. (Un simple reload
      // pouvait partir avant la prise en compte du fragment, et recharger
      // l'adresse précédente.)
      loaded.catch(() => {});
      loaded = nextLoad();
      await send('Page.navigate', { url: 'about:blank' });
      await loaded;
      loaded = nextLoad();
      await send('Page.navigate', { url: job.url });
    }
    await loaded;
    await sleep(job.wait ?? 1500);

    if (job.script) {
      const res = await send('Runtime.evaluate', { expression: job.script, awaitPromise: true, returnByValue: true });
      if (res.exceptionDetails) problems.push(`SCRIPT ${res.exceptionDetails.exception?.description}`);
      else if (res.result?.value !== undefined) console.log(`  [${job.name}] script → ${JSON.stringify(res.result.value)}`);
      await sleep(job.afterScriptWait ?? 600);
    }

    const { result } = await send('Runtime.evaluate', {
      expression: 'JSON.stringify({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })',
      returnByValue: true,
    });
    const { sw, iw } = JSON.parse(result.value);

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!job.fullPage });
    writeFileSync(join(outDir, `${job.name}.png`), Buffer.from(shot.data, 'base64'));

    const overflow = sw > iw ? `DÉBORDEMENT horizontal ${sw}px > ${iw}px` : 'pas de débordement';
    console.log(`${job.name.padEnd(22)} ${width}x${height} ${job.scheme ?? 'light'}  ${overflow}`);
    const reported = new Set();
    for (const problem of problems) {
      const known = knownWarnings.find(({ pattern }) => pattern.test(problem));
      if (!known) {
        console.log(`    ! ${problem}`);
      }
      else if (!reported.has(known.reason)) {
        reported.add(known.reason);
        console.log(`    · connu : ${known.reason}`);
      }
    }
    }
    finally {
      listeners.splice(listeners.indexOf(onEvent), 1);
    }
  }

  // Chaque page est isolée : un incident est signalé sans interrompre la série.
  // Une page rechargée en plein script (le serveur de dev le fait quand il
  // découvre une dépendance) est rejouée une fois.
  for (const job of jobs) {
    for (let attempt = 1; ; attempt++) {
      try {
        await runJob(job);
        break;
      }
      catch (error) {
        const reloaded = /navigated|context was destroyed/i.test(error.message);
        if (reloaded && attempt === 1) {
          console.log(`  [${job.name}] page rechargée pendant le script, nouvel essai`);
          await sleep(1500);
          continue;
        }
        console.log(`${job.name.padEnd(22)} ! ÉCHEC DU SCÉNARIO : ${error.message}`);
        process.exitCode = 1;
        break;
      }
    }
  }

  ws.close();
}

run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => chrome.kill());
