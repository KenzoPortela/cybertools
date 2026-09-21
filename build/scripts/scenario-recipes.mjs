/**
 * Vérifie l'atelier de recettes et Magic, dans un vrai navigateur.
 *
 * usage : node build/scripts/scenario-recipes.mjs [--base http://localhost:5173]
 *         puis : npm run screenshot -- build/scenarios/recipes.json
 *
 * Les pages s'enchaînent dans le même onglet : la recette sauvegardée par une
 * étape sert à la suivante (restauration). L'ordre compte.
 */
import { writeFileSync } from 'node:fs';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'http://localhost:5173';

/** Outils communs, injectés en tête de chaque script. */
const helpers = `
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, timeout = 15000) => {
    for (const started = performance.now(); performance.now() - started < timeout;) {
      const value = test();
      if (value) return value;
      await sleep(100);
    }
    return null;
  };
  const type = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const addOperation = async (query) => {
    const field = document.querySelector('.ops-search');
    field.focus();
    type(field, query);
    await sleep(250);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(250);
  };
  const stepNames = () => [...document.querySelectorAll('.steps .step-name')].map(e => e.textContent.trim());
  const idle = () => until(() => !document.querySelector('.workbench [aria-busy="true"], .magic-tool [aria-busy="true"]'), 20000);
  const output = async () => {
    await sleep(500);
    await idle();
    return document.querySelectorAll('.io-column textarea')[1]?.value ?? null;
  };
  const inputField = () => document.querySelector('.io-column textarea');
  // Prêt = interactif : le champ des opérations (atelier), la saisie (Magic),
  // le contenu de l'outil sinon. \`.tool-content\` seul apparaît avant que
  // l'atelier ou Magic aient fini de charger.
  await until(() => { const path = location.pathname; if (path.endsWith('/recipes')) return document.querySelector('.workbench .pane--ops input'); if (path.endsWith('/magic')) return document.querySelector('.magic-tool textarea'); return document.querySelector('.tool-content'); });
`;

const script = body => `(async () => {${helpers}${body}})()`;

// « aGVsbG8= » encodé en base64 : l'entrée d'un lien CyberChef.
const INPUT_B64 = 'YUdWc2JHOD0';

const jobs = [
  {
    name: 'recettes-remise-a-zero',
    url: `${base}/`,
    script: `(() => { localStorage.removeItem('cybertools:recipe'); return true; })()`,
  },
  {
    name: 'recettes-vide',
    url: `${base}/tools/recipes`,
    script: script(`
      await until(() => document.querySelector('.workbench .empty'));
      // Sans recette précédente, pas de bouton « Reprendre ».
      return (!!document.querySelector('.workbench .empty') && !document.querySelector('.resume')) || 'état vide incorrect';
    `),
  },
  {
    name: 'recettes-composer',
    url: `${base}/tools/recipes`,
    script: script(`
      await addOperation('from base64');
      await addOperation('to hex');
      type(inputField(), 'aGVsbG8=');
      const out = await output();
      await sleep(900);
      const names = stepNames();
      const ok = names.join(' + ') === 'From Base64 + To Hex' && out === '68 65 6c 6c 6f' && location.hash.startsWith('#recipe=From_Base64');
      return ok || { étapes: names, sortie: out, adresse: location.hash.slice(0, 80) };
    `),
  },
  {
    name: 'recettes-lien-cyberchef',
    url: `${base}/tools/recipes#recipe=From_Base64('A-Za-z0-9%2B/%3D',true,false)To_Hex('Space',0)&input=${INPUT_B64}`,
    script: script(`
      await until(() => stepNames().length === 2);
      const out = await output();
      await sleep(900);
      // L'alphabet contient un « + » : il doit survivre à la lecture du lien, puis
      // à la réécriture de l'adresse (encodé une seule fois, en %2B).
      const alphabet = document.querySelector('.steps .step .params-grid .field input')?.value;
      const ok = stepNames().join(' + ') === 'From Base64 + To Hex' && inputField().value === 'aGVsbG8=' && out === '68 65 6c 6c 6f'
        && alphabet === 'A-Za-z0-9+/=' && location.hash.includes("A-Za-z0-9%2B/%3D") && !location.hash.includes('%25');
      return ok || { étapes: stepNames(), entrée: inputField()?.value, sortie: out, alphabet, adresse: location.hash.slice(0, 90) };
    `),
  },
  {
    // Recherche mot à mot, fautes tolérées : le nom exact n'est pas requis.
    name: 'recettes-recherche-souple',
    url: `${base}/tools/recipes`,
    script: script(`
      const field = document.querySelector('.ops-search');
      field.focus();
      type(field, 'caeser cipher');
      await sleep(300);
      const options = [...document.querySelectorAll('.ops-list [role=option]')].map(e => e.textContent.trim());
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      type(field, '');
      const found = name => options.some(text => text.startsWith(name));
      return (found('Caesar Box Cipher') && found('ROT13')) || { options: options.slice(0, 6) };
    `),
  },
  {
    // L'atelier s'ouvre vide ; la dernière recette se reprend d'un clic.
    name: 'recettes-reprise',
    url: `${base}/tools/recipes`,
    script: script(`
      const resume = await until(() => document.querySelector('.workbench .empty .resume'));
      if (!resume) return { vide: !!document.querySelector('.workbench .empty'), étapes: stepNames() };
      resume.click();
      await until(() => stepNames().length);
      return stepNames().join(' + ') === 'From Base64 + To Hex' || { étapes: stepNames() };
    `),
  },
  {
    name: 'recettes-etape-en-echec',
    url: `${base}/tools/recipes#recipe=From_Hex('Auto')Jq('.a%5B',false)&input=N2I3ZA%3D%3D`,
    script: script(`
      await until(() => stepNames().length === 2);
      await output();
      await sleep(400);
      const failed = [...document.querySelectorAll('.steps .step')].findIndex(e => e.classList.contains('step--failed'));
      const warning = document.querySelector('.stopped-notice, .op-error')?.innerText.trim();
      return (failed === 1 && /2/.test(warning ?? '')) || { étapeEnÉchec: failed, message: warning };
    `),
  },
  {
    name: 'recettes-operation-ecartee',
    url: `${base}/tools/recipes#recipe=To_Upper_case('All')HTTP_request('GET','https://example.com','',false,false)`,
    script: script(`
      await until(() => document.querySelector('.workbench .notice'));
      const notice = document.querySelector('.workbench .notice')?.innerText ?? '';
      return (stepNames().join() === 'To Upper case' && notice.includes('HTTP request')) || { étapes: stepNames(), avis: notice };
    `),
  },
  {
    name: 'recettes-magic',
    url: `${base}/tools/recipes`,
    script: script(`
      document.querySelector('.recipe-clear')?.click();
      await sleep(300);
      type(inputField(), 'aGVsbG8gd29ybGQ=');
      [...document.querySelectorAll('.workbench-actions button')].find(b => b.textContent.includes('Magic')).click();
      const first = await until(() => document.querySelector('.magic-card .candidate'), 20000);
      if (!first) return 'aucun candidat Magic';
      const label = first.querySelector('.candidate-recipe').textContent;
      first.querySelector('button').click();
      const out = await output();
      return (label.includes('From Base64') && stepNames().includes('From Base64') && out === 'hello world') || { candidat: label, étapes: stepNames(), sortie: out };
    `),
  },
  {
    name: 'magic-outil',
    url: `${base}/tools/magic`,
    script: script(`
      type(document.querySelector('.magic-tool textarea'), '68656c6c6f20776f726c64');
      const candidate = await until(() => [...document.querySelectorAll('.magic-tool .candidate')].find(c => c.querySelector('.candidate-recipe').textContent.includes('From Hex')), 20000);
      if (!candidate) return 'pas de piste From Hex';
      candidate.querySelector('button').click();
      await until(() => location.pathname === '/tools/recipes' && stepNames().length);
      const out = await output();
      return (stepNames().includes('From Hex') && out === 'hello world') || { adresse: location.pathname, étapes: stepNames(), sortie: out };
    `),
  },
  // Profondeur automatique de Magic : une, deux, trois couches, puis rien.
  ...[
    ['1', 'aGVsbG8gd29ybGQ=', 1, 'From Base64'],
    ['2', 'Njg2NTZjNmM2ZjIwNzc2ZjcyNmM2NA==', 2, 'From Base64 → From Hex'],
    ['3', 'TmpnMk5UWmpObU0yWmpJd056YzJaamN5Tm1NMk5BPT0=', 3, 'From Base64 → From Base64 → From Hex'],
  ].map(([name, data, layers, recipe]) => ({
    name: `magic-auto-${name}`,
    url: `${base}/tools/magic`,
    script: script(`
      type(document.querySelector('.magic-tool textarea'), '${data}');
      const status = await until(() => /(détectée|Detected).*${layers}/.test(document.querySelector('.depth-status')?.textContent ?? '') && document.querySelector('.depth-status'), 30000);
      const first = document.querySelector('.magic-tool .candidate');
      const label = first?.querySelector('.candidate-recipe').textContent.trim();
      const data = first?.querySelector('.candidate-data').textContent.trim();
      return (!!status && label === '${recipe}' && data === 'hello world') || { statut: document.querySelector('.depth-status')?.textContent.trim(), piste: label, donnée: data };
    `),
  })),
  {
    name: 'magic-auto-clair',
    url: `${base}/tools/magic`,
    script: script(`
      type(document.querySelector('.magic-tool textarea'), 'Just some plain English text here.');
      const status = await until(() => /(Rien à décoder|Nothing to decode)/.test(document.querySelector('.depth-status')?.textContent ?? ''), 30000);
      return !!status || document.querySelector('.depth-status')?.textContent.trim();
    `),
  },
  {
    name: 'magic-manuel',
    url: `${base}/tools/magic`,
    script: script(`
      type(document.querySelector('.magic-tool textarea'), 'aGVsbG8gd29ybGQ=');
      [...document.querySelectorAll('.depth-mode label')][1].click();
      await sleep(400);
      const input = document.querySelector('.magic .depth input');
      const candidate = await until(() => document.querySelector('.magic-tool .candidate'), 20000);
      await sleep(600);
      return (!!input && input.value === '3' && !document.querySelector('.depth-status') && !!candidate) || { profondeur: input?.value, statut: document.querySelector('.depth-status')?.textContent };
    `),
  },
  {
    name: 'recettes-depuis-it-tools',
    url: `${base}/tools/base64-string-converter`,
    script: script(`
      const link = await until(() => document.querySelector('.recipes-link'));
      if (!link) return 'lien vers les Recettes absent';
      link.click();
      await until(() => location.pathname === '/tools/recipes' && stepNames().length);
      return stepNames().join(' + ') === 'To Base64 + From Base64' || { étapes: stepNames() };
    `),
  },
  {
    name: 'recettes-depuis-operation',
    url: `${base}/tools/to-hex`,
    script: script(`
      await until(() => document.querySelector('.cc-op .io textarea'));
      type(document.querySelector('.cc-op .io textarea'), 'abc');
      await sleep(300);
      [...document.querySelectorAll('.op-toolbar button')][0].click();
      await until(() => location.pathname === '/tools/recipes' && stepNames().length);
      const out = await output();
      return (stepNames().join() === 'To Hex' && out === '61 62 63') || { étapes: stepNames(), sortie: out };
    `),
  },
  {
    name: 'recettes-partage',
    url: `${base}/tools/recipes`,
    script: script(`
      (await until(() => document.querySelector('.workbench .empty .resume')))?.click();
      await until(() => stepNames().length);
      [...document.querySelectorAll('.workbench-actions button')].find(b => /Partager|Share/.test(b.textContent)).click();
      const link = await until(() => document.querySelector('.share textarea')?.value);
      const cyberchef = document.querySelector('.share-actions a')?.getAttribute('href') ?? '';
      return (link.includes('/tools/recipes#recipe=To_Hex') && cyberchef.startsWith('https://gchq.github.io/CyberChef/#recipe=To_Hex')) || { lien: link, cyberchef };
    `),
  },
  {
    // Magic comme étape de recette : CyberChef présente ses pistes en tableau,
    // dont chaque lien est un fragment #recipe=… à la manière de cyberchef.org.
    // Le suivre doit charger la piste dans l'atelier.
    name: 'recettes-lien-interne',
    url: `${base}/tools/recipes#recipe=Magic(3,false,false,'')&input=${INPUT_B64}`,
    script: script(`
      const link = await until(() => document.querySelector('.html-output a[href^="#recipe="]'), 20000);
      if (!link) return 'aucun lien de piste dans la sortie de Magic';
      link.click();
      await until(() => stepNames().join() === 'From Base64');
      const out = await output();
      return (stepNames().join() === 'From Base64' && out === 'hello') || { étapes: stepNames(), sortie: out };
    `),
  },
  {
    name: 'recettes-mobile',
    url: `${base}/tools/recipes#recipe=From_Base64('A-Za-z0-9%2B/%3D',true,false)To_Hex('Space',0)&input=${INPUT_B64}`,
    width: 390,
    height: 844,
    mobile: true,
    scheme: 'dark',
    fullPage: true,
    script: script(`
      await until(() => stepNames().length === 2);
      return (await output()) === '68 65 6c 6c 6f';
    `),
  },
  // Atelier en panneaux, panneau d'opérations, étapes, entrée et sortie.
  {
    name: 'atelier-panneaux',
    url: `${base}/tools/recipes`,
    width: 1440,
    height: 900,
    scheme: "dark",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .pane--ops input'); i++) await sleep(100); const widths = [...document.querySelectorAll('.workbench .pane')].map(p => Math.round(p.getBoundingClientRect().width)); const height = Math.round(document.querySelector('.workbench').getBoundingClientRect().height); const rail = Math.round(document.querySelector('.rail').getBoundingClientRect().width); const actions = document.querySelector('.workbench-actions').getBoundingClientRect().left; const star = document.querySelector('#ct-topbar-actions .favorite').getBoundingClientRect().left; const ok = widths[0] === 236 && widths[1] === 398 && widths[2] > 600 && height === 900 - 48 && !document.querySelector('.status-bar') && rail === 48 && actions < star; return ok || { widths, height, rail, actions, star }; })()`,
  },
  {
    name: 'atelier-redimension',
    url: `${base}/tools/recipes`,
    width: 1440,
    height: 900,
    scheme: "light",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .pane--ops input'); i++) await sleep(100); const handle = document.querySelector('.pane-resizer'); handle.focus(); for (let i = 0; i < 2; i++) handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await sleep(500); const width = Math.round(document.querySelector('.pane--ops').getBoundingClientRect().width); const saved = JSON.parse(localStorage.getItem('cybertools:settings')).recipesOpsWidth; for (let i = 0; i < 2; i++) handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await sleep(500); const restored = JSON.parse(localStorage.getItem('cybertools:settings')).recipesOpsWidth; return (width === 268 && saved === 268 && restored === 236 && handle.getAttribute('role') === 'separator') || { width, saved, restored }; })()`,
  },
  {
    name: 'atelier-rail-rappel',
    url: `${base}/tools/recipes`,
    width: 1440,
    height: 900,
    scheme: "light",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .pane--ops input'); i++) await sleep(100); const before = Math.round(document.querySelector('.rail').getBoundingClientRect().width); document.querySelector('.rail-collapse').click(); await sleep(500); const after = Math.round(document.querySelector('.rail').getBoundingClientRect().width); const setting = JSON.parse(localStorage.getItem('cybertools:settings') || '{}').shellRailCollapsed; return (before === 48 && after === 224 && !setting) || { before, after, setting }; })()`,
  },
  {
    name: 'atelier-empile',
    url: `${base}/tools/recipes`,
    width: 900,
    height: 900,
    scheme: "dark",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .pane--ops input'); i++) await sleep(100); const panes = [...document.querySelectorAll('.workbench .pane')].map(p => p.getBoundingClientRect()); const stacked = panes[0].bottom <= panes[1].top && panes[1].bottom <= panes[2].top; const resizers = [...document.querySelectorAll('.pane-resizer')].every(r => getComputedStyle(r).display === 'none'); const io = ['.cc-input', '.cc-output', '.run-banner'].map(sel => document.querySelector(sel).getBoundingClientRect()); const ioStacked = io[0].bottom <= io[1].top + 1 && io[1].bottom <= io[2].top + 1 && io.every(b => b.height > 20); return (stacked && resizers && ioStacked) || { stacked, resizers, io: io.map(b => [Math.round(b.top), Math.round(b.height)]) }; })()`,
  },
  {
    name: 'ops-groupes',
    url: `${base}/tools/recipes`,
    width: 1440,
    height: 900,
    scheme: "light",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .ops-search'); i++) await sleep(100); const labels = [...document.querySelectorAll('.ops-group-label span:first-child')].map(e => e.textContent.trim()); const count = Number(document.querySelector('.ops-count').textContent); const options = document.querySelectorAll('.ops-list [role=option]').length; return (labels[0] === 'Suggestions' && labels.includes('Encoding') && labels.includes('Flow control') && count > 400 && options > count) || { labels, count, options }; })()`,
  },
  {
    name: 'ops-remplacer',
    url: `${base}/tools/recipes#recipe=To_Base64('A-Za-z0-9%2B/%3D')To_Hex('Space',0)`,
    width: 1440,
    height: 900,
    scheme: "light",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .ops-search'); i++) await sleep(100); const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; const names = () => [...document.querySelectorAll('.steps .step-name')].map(e => e.textContent.trim()); const key = (el, k, shift = false) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true })); for (let i = 0; i < 50 && names().length < 2; i++) await sleep(100); const before = names(); const field = document.querySelector('.ops-search'); field.focus(); type(field, 'gunzip'); await sleep(300); key(field, 'Enter', true); await sleep(500); const after = names(); return (before.length === 2 && after.join() === 'Gunzip' && document.activeElement === field) || { before, after }; })()`,
  },
  {
    name: 'etape-compacte',
    url: `${base}/tools/recipes#recipe=From_Base64('A-Za-z0-9%2B/%3D',true,false)`,
    width: 1440,
    height: 900,
    scheme: "dark",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); for (let i = 0; i < 150 && !document.querySelector('.workbench .ops-search'); i++) await sleep(100); for (let i = 0; i < 50 && !document.querySelector('.steps .step'); i++) await sleep(100); const step = document.querySelector('.steps .step'); const head = Math.round(step.querySelector('.step-head').getBoundingClientRect().height); const columns = getComputedStyle(step.querySelector('.params-grid')).gridTemplateColumns.split(' ').length; const rail = step.querySelector('.n-switch__rail'); const switchSize = Math.round(rail.getBoundingClientRect().width) + 'x' + Math.round(rail.getBoundingClientRect().height); const move = getComputedStyle(step.querySelector('.step-action--move')).opacity; const label = step.querySelector('.n-switch').getAttribute('aria-label'); return (head === 32 && columns === 2 && switchSize === '22x13' && move === '0' && !!label) || { head, columns, switchSize, move, label }; })()`,
  },
  {
    name: 'io-ressemble-et-bandeau',
    url: `${base}/tools/recipes#recipe=From_Base64('A-Za-z0-9%2B/%3D',true,false)Gunzip()`,
    width: 1440,
    height: 900,
    scheme: "dark",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, timeout = 15000) => { for (const t0 = performance.now(); performance.now() - t0 < timeout;) { const v = test(); if (v) return v; await sleep(100); } return null; };
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const text = sel => document.querySelector(sel)?.textContent.replace(/\\s+/g, ' ').trim();
  await until(() => document.querySelector('.io-column textarea'));
  type(document.querySelector('.io-column textarea'), 'H4sIAAAAAAAACvNIzcnJVyjPL8pJ0VFIK8rPVUiuTEotKsnPzylWBAC4xs7eHQAAAA==');
  await until(() => document.querySelector('.run-state--done'));
  await sleep(400);
  const strip = text('.cc-input .io-strip');
  const banner = [...document.querySelectorAll('.run-banner > span')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()).join(' | ');
  const out = document.querySelectorAll('.io-column textarea')[1].value;
  return (/looks like: base64 → GZIP/.test(strip) && /^done \\| 68 o → 29 o \\| \\d+ ms \\| 2 steps · 0 errors \\| 0 external requests$/.test(banner) && out === 'Hello world, from cybertools!') || { strip, banner, out };
})()`,
  },
  {
    name: 'io-gouttieres',
    url: `${base}/tools/recipes#recipe=To_Upper_case('All')`,
    width: 1440,
    height: 900,
    scheme: "light",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, timeout = 15000) => { for (const t0 = performance.now(); performance.now() - t0 < timeout;) { const v = test(); if (v) return v; await sleep(100); } return null; };
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const text = sel => document.querySelector(sel)?.textContent.replace(/\\s+/g, ' ').trim();
  await until(() => document.querySelector('.io-column textarea'));
  type(document.querySelector('.io-column textarea'), 'un\\ndeux\\ntrois');
  await until(() => document.querySelectorAll('.io-column textarea')[1].value === 'UN\\nDEUX\\nTROIS');
  await sleep(300);
  const gutters = [...document.querySelectorAll('.io-column .code-gutter')].map(g => [...g.querySelectorAll('.code-gutter-line')].map(l => l.textContent.trim()).join(','));
  return (gutters[0] === '1,2,3' && gutters[1] === '00000000,00000003,00000008') || gutters;
})()`,
  },
  {
    name: 'io-onglets',
    url: `${base}/tools/recipes#recipe=JSON_Minify()`,
    width: 1440,
    height: 900,
    scheme: "dark",
    script: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, timeout = 15000) => { for (const t0 = performance.now(); performance.now() - t0 < timeout;) { const v = test(); if (v) return v; await sleep(100); } return null; };
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const text = sel => document.querySelector(sel)?.textContent.replace(/\\s+/g, ' ').trim();
  await until(() => document.querySelector('.io-column textarea'));
  type(document.querySelector('.io-column textarea'), '{ "a": 1, "b": [true, null] }');
  await until(() => document.querySelectorAll('.io-column textarea')[1]?.value === '{"a":1,"b":[true,null]}');
  const tabs = () => [...document.querySelectorAll('.cc-output [role=tab]')];
  const pick = name => tabs().find(b => b.textContent.trim() === name).click();
  const disabled = tabs().filter(b => b.disabled).map(b => b.textContent.trim());
  pick('hex'); await sleep(300);
  const hex = document.querySelector('.cc-output .io-pre')?.textContent.slice(0, 8);
  pick('tree'); await sleep(300);
  const leaves = [...document.querySelectorAll('.cc-output .leaf')].map(l => l.textContent.replace(/\\s+/g, '')).join(',');
  pick('diff'); await sleep(300);
  const diff = [...document.querySelectorAll('.cc-output .diff-line')].map(l => l.className.replace('diff-line diff-line--', '')[0]).join('');
  return (disabled.length === 0 && hex === '00000000' && leaves === 'a1,0true,1null' && diff.startsWith('r') && diff.includes('a')) || { disabled, hex, leaves, diff };
})()`,
  },
  {
    name: 'accueil-a-la-une',
    url: `${base}/`,
    script: `(() => [...document.querySelectorAll('.tiles .tile')].map(a => a.getAttribute('href')).join() === '/tools/recipes,/tools/magic,/tools/stego-lab')()`,
  },
].map(job => ({ scheme: 'light', wait: 300, ...job }));

writeFileSync('build/scenarios/recipes.json', `${JSON.stringify(jobs, null, 2)}\n`);
console.log(`${jobs.length} vérifications → build/scenarios/recipes.json`);
