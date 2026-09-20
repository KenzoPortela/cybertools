/**
 * Vérifie le Stego Lab dans un vrai navigateur.
 *
 * usage : node build/scripts/scenario-stego.mjs [--base http://localhost:5173]
 *         puis : npm run screenshot -- build/scenarios/stego.json
 *
 * L'image de test est fabriquée dans la page (canvas → PNG → File) et injectée
 * dans le champ fichier : le scénario est autonome, sans fixture sur le disque.
 */
import { writeFileSync } from 'node:fs';

const baseIndex = process.argv.indexOf('--base');
const base = baseIndex > -1 ? process.argv[baseIndex + 1] : 'http://localhost:5173';

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
  // Fabrique une petite image PNG déterministe et la dépose dans le champ fichier.
  const loadImage = async (w = 64, h = 48) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#101613'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3dd68c'; ctx.fillRect(8, 8, 20, 20);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'test.png', { type: 'image/png' });
    const input = document.querySelector('.stego-file-input');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const openTab = (label) => {
    const tab = [...document.querySelectorAll('.n-tabs-tab')].find(el => el.textContent.trim() === label);
    if (tab) tab.click();
    return !!tab;
  };
  // Un canvas de résultat a dessiné quelque chose (des pixels opaques) ?
  const drawn = (root) => {
    const canvas = root?.querySelector('.viewer canvas');
    if (!canvas || !canvas.width || !canvas.height) return false;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4 * 89) if (data[i] > 0) return true;
    return false;
  };
`;

const script = body => `(async () => {${helpers}${body}})()`;

const jobs = [
  {
    name: 'stego-empty',
    url: `${base}/tools/stego-lab`,
    script: script(`
      const drop = await until(() => document.querySelector('.stego-drop'));
      return (!!drop && !document.querySelector('.stego-dims')) || 'zone de dépôt absente';
    `),
  },
  {
    name: 'stego-load',
    url: `${base}/tools/stego-lab`,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(64, 48);
      const dims = await until(() => document.querySelector('.stego-dims')?.textContent);
      const engine = await until(() => document.querySelector('.stego-engine-ok'), 20000);
      const canvas = document.querySelector('.viewer canvas');
      const ok = /64/.test(dims ?? '') && /48/.test(dims ?? '') && !!engine && !!canvas;
      return ok || { dimensions: dims, moteur: !!engine, canvas: !!canvas };
    `),
  },
  {
    name: 'stego-bitplanes',
    url: `${base}/tools/stego-lab`,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(64, 48);
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Bit planes');
      const panel = await until(() => document.querySelector('.stego-panel-bitplanes'), 20000);
      const canvas = await until(() => drawn(panel), 20000);
      const controls = panel?.querySelectorAll('.n-radio-button').length;
      return (!!canvas && controls >= 12) || { canvas: !!canvas, controls };
    `),
  },
  {
    name: 'stego-channels',
    url: `${base}/tools/stego-lab`,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(64, 48);
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Channels');
      const panel = await until(() => document.querySelector('.stego-panel-channels'), 20000);
      await until(() => drawn(panel), 20000);
      // Bascule sur « Invert » : le résultat doit rester dessiné.
      [...panel.querySelectorAll('.n-radio-button')].find(el => /Invert/.test(el.textContent))?.click();
      await sleep(400);
      return drawn(panel) || 'canal non rendu';
    `),
  },
  {
    name: 'stego-entropy',
    url: `${base}/tools/stego-lab`,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(96, 64);
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Entropy');
      const panel = await until(() => document.querySelector('.stego-panel-entropy'), 20000);
      const canvas = await until(() => drawn(panel), 20000);
      return (!!canvas && !!panel.querySelector('.ramp')) || { canvas: !!canvas };
    `),
  },
  {
    name: 'stego-dark',
    url: `${base}/tools/stego-lab`,
    scheme: 'dark',
    fullPage: true,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(96, 64);
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Bit planes');
      await until(() => drawn(document.querySelector('.stego-panel-bitplanes')), 20000);
      await sleep(300);
      return true;
    `),
  },
  {
    name: 'stego-mobile',
    url: `${base}/tools/stego-lab`,
    width: 390,
    height: 844,
    mobile: true,
    scheme: 'dark',
    fullPage: true,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(80, 100);
      return (await until(() => document.querySelector('.stego-dims'))) !== null;
    `),
  },
].map(job => ({ scheme: 'light', wait: 300, ...job }));

writeFileSync('build/scenarios/stego.json', `${JSON.stringify(jobs, null, 2)}\n`);
console.log(`${jobs.length} vérifications → build/scenarios/stego.json`);
