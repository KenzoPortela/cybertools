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
  // Fabrique un PNG piégé : un chunk tEXt caché + une archive ZIP collée derrière.
  const crcTable = (() => {
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const textChunk = (keyword, text) => {
    const enc = new TextEncoder();
    const kw = enc.encode(keyword); const tx = enc.encode(text);
    const data = new Uint8Array(kw.length + 1 + tx.length);
    data.set(kw, 0); data[kw.length] = 0; data.set(tx, kw.length + 1);
    const type = enc.encode('tEXt');
    const typed = new Uint8Array(type.length + data.length);
    typed.set(type, 0); typed.set(data, type.length);
    const chunk = new Uint8Array(4 + typed.length + 4);
    chunk.set(u32(data.length), 0);
    chunk.set(typed, 4);
    chunk.set(u32(crc32(typed)), 4 + typed.length);
    return chunk;
  };
  const loadStegoPng = async () => {
    const c = document.createElement('canvas'); c.width = 48; c.height = 32;
    c.getContext('2d').fillStyle = '#3dd68c'; c.getContext('2d').fillRect(0, 0, 48, 32);
    const png = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
    const iend = png.length - 12; // IEND fait toujours les 12 derniers octets
    const text = textChunk('Comment', 'hidden flag{test}');
    const zip = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6]);
    const out = new Uint8Array(iend + text.length + 12 + zip.length);
    out.set(png.subarray(0, iend), 0);
    out.set(text, iend);
    out.set(png.subarray(iend, iend + 12), iend + text.length);
    out.set(zip, iend + text.length + 12);
    const input = document.querySelector('.stego-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File([out], 'stego.png', { type: 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
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
    name: 'stego-metadata',
    url: `${base}/tools/stego-lab`,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadImage(48, 32);
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Metadata');
      const panel = await until(() => document.querySelector('.stego-panel-metadata'), 20000);
      // exifr lit au moins l'en-tête PNG (ihdr) ; sinon l'état vide s'affiche, sans erreur.
      const done = await until(() => !panel.querySelector('.n-spin') && (panel.querySelector('.group') || /No metadata|Aucune/.test(panel.textContent)), 15000);
      return !!done || panel.textContent.slice(0, 80);
    `),
  },
  {
    name: 'stego-structure',
    url: `${base}/tools/stego-lab`,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadStegoPng();
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Structure');
      const panel = await until(() => document.querySelector('.stego-panel-structure'), 20000);
      await until(() => panel.textContent.includes('flag{test}'), 8000);
      const polyglot = !!panel.querySelector('.polyglot');
      const trailing = !!panel.querySelector('.stego-trailing-download');
      const zip = /ZIP/.test(panel.textContent);
      const text = panel.textContent.includes('flag{test}');
      return (polyglot && trailing && zip && text) || { polyglot, trailing, zip, text };
    `),
  },
  {
    name: 'stego-structure-dark',
    url: `${base}/tools/stego-lab`,
    scheme: 'dark',
    fullPage: true,
    script: script(`
      await until(() => document.querySelector('.stego-drop'));
      await loadStegoPng();
      await until(() => document.querySelector('.stego-engine-ok'), 20000);
      openTab('Structure');
      await until(() => document.querySelector('.stego-panel-structure')?.textContent.includes('flag{test}'), 15000);
      await sleep(300);
      return true;
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
