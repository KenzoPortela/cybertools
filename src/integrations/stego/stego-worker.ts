/**
 * Web Worker du Stego Lab : toutes les analyses pixel, hors du thread principal.
 *
 * L'image est chargée une fois (`load`), gardée par le worker, puis les
 * panneaux demandent des vues calculées (plan de bits, canal rehaussé, carte
 * d'entropie). Chaque résultat est un RGBA transféré (zéro-copie).
 *
 * Tout est réécrit ici, sans dépendance : ce sont des opérations pixel simples.
 */
import { matchAt } from '~/integrations/stego/formats/signatures';

export type Channel = 0 | 1 | 2 | 3;
export type ChannelView = 'rgb' | 'r' | 'g' | 'b' | 'a' | 'luma';
export type Enhance = 'none' | 'invert' | 'threshold' | 'stretch' | 'equalise';

export type StegoOp =
  | { type: 'load'; width: number; height: number; data: ArrayBuffer }
  | { type: 'bitPlane'; channel: Channel; bit: number; colour: boolean }
  | { type: 'channel'; view: ChannelView; enhance: Enhance; level: number }
  | { type: 'entropy'; block: number }
  | { type: 'lsb'; channels: Channel[]; bits: number; msbFirst: boolean; column: boolean; limit: number }
  | { type: 'lsbScan'; limit: number }
  | { type: 'loadSecond'; width: number; height: number; data: ArrayBuffer }
  | { type: 'ela'; quality: number; scale: number }
  | { type: 'compare'; mode: 'diff' | 'xor' | 'overlay'; opacity: number };

export interface LsbScanResult {
  label: string;
  bits: number;
  channels: Channel[];
  msbFirst: boolean;
  column: boolean;
  kind: 'text' | 'file';
  preview: string;
  score: number;
}

export interface StegoRequest {
  id: number;
  op: StegoOp;
}

export type StegoReply =
  | { id: number; type: 'loaded' }
  | { id: number; type: 'loaded2' }
  | { id: number; type: 'result'; width: number; height: number; data: ArrayBuffer }
  | { id: number; type: 'bytes'; data: ArrayBuffer }
  | { id: number; type: 'scan'; results: LsbScanResult[] }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as Worker;

let src: Uint8ClampedArray | undefined;
let width = 0;
let height = 0;

// Seconde image, pour la comparaison.
let src2: Uint8ClampedArray | undefined;
let width2 = 0;
let height2 = 0;

function reply(message: StegoReply, transfer: Transferable[] = []) {
  ctx.postMessage(message, transfer);
}

function result(id: number, out: Uint8ClampedArray) {
  const buffer = out.buffer as ArrayBuffer;
  reply({ id, type: 'result', width, height, data: buffer }, [buffer]);
}

/**
 * Extraction LSB (façon zsteg) : lit les `bits` bits de poids faible de chaque
 * canal choisi, dans l'ordre donné, pixel par pixel (par lignes ou colonnes),
 * et empile ces bits en octets. Le résultat brut peut ensuite être lu comme
 * texte, hexdump, ou ré-injecté dans les Recettes.
 */
function lsb(channels: Channel[], bits: number, msbFirst: boolean, column: boolean, limit: number): Uint8Array {
  const out = new Uint8Array(limit);
  let byte = 0;
  let nbits = 0;
  let count = 0;

  const visit = (index: number): boolean => {
    for (const channel of channels) {
      const value = src![index * 4 + channel];
      for (let k = 0; k < bits; k++) {
        const b = (value >> k) & 1;
        byte = msbFirst ? ((byte << 1) | b) : (byte | (b << nbits));
        if (++nbits === 8) {
          out[count++] = byte;
          byte = 0;
          nbits = 0;
          if (count >= limit) return true;
        }
      }
    }
    return false;
  };

  if (column) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) if (visit(y * width + x)) return out.subarray(0, count);
    }
  }
  else {
    for (let i = 0; i < width * height; i++) if (visit(i)) return out.subarray(0, count);
  }
  return out.subarray(0, count);
}

// --- Opérations ---------------------------------------------------------------

function bitPlane(channel: Channel, bit: number, colour: boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const mask = 1 << bit;
  for (let i = 0; i < width * height; i++) {
    const on = (src![i * 4 + channel] & mask) !== 0 ? 255 : 0;
    const o = i * 4;
    if (colour && channel < 3) {
      out[o] = channel === 0 ? on : 0;
      out[o + 1] = channel === 1 ? on : 0;
      out[o + 2] = channel === 2 ? on : 0;
    }
    else {
      out[o] = on;
      out[o + 1] = on;
      out[o + 2] = on;
    }
    out[o + 3] = 255;
  }
  return out;
}

function channelView(view: ChannelView): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const r = src![o];
    const g = src![o + 1];
    const b = src![o + 2];
    const a = src![o + 3];
    let value: number;
    switch (view) {
      case 'rgb':
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
        continue;
      case 'r': value = r; break;
      case 'g': value = g; break;
      case 'b': value = b; break;
      case 'a': value = a; break;
      default: value = Math.round(0.299 * r + 0.587 * g + 0.114 * b); break;
    }
    out[o] = value; out[o + 1] = value; out[o + 2] = value; out[o + 3] = 255;
  }
  return out;
}

/** Applique un rehaussement en place, canal par canal (l'alpha reste intact). */
function enhance(out: Uint8ClampedArray, mode: Enhance, level: number) {
  const pixels = width * height;
  if (mode === 'invert') {
    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      out[o] = 255 - out[o];
      out[o + 1] = 255 - out[o + 1];
      out[o + 2] = 255 - out[o + 2];
    }
    return;
  }
  if (mode === 'threshold') {
    for (let i = 0; i < pixels; i++) {
      const o = i * 4;
      for (let c = 0; c < 3; c++) out[o + c] = out[o + c] >= level ? 255 : 0;
    }
    return;
  }
  if (mode === 'stretch' || mode === 'equalise') {
    // Un histogramme et une table de correspondance par canal.
    for (let c = 0; c < 3; c++) {
      const hist = new Uint32Array(256);
      for (let i = 0; i < pixels; i++) hist[out[i * 4 + c]]++;
      const map = new Uint8ClampedArray(256);
      if (mode === 'stretch') {
        let min = 0;
        let max = 255;
        while (min < 255 && hist[min] === 0) min++;
        while (max > 0 && hist[max] === 0) max--;
        const span = Math.max(1, max - min);
        for (let v = 0; v < 256; v++) map[v] = ((v - min) / span) * 255;
      }
      else {
        let cumulative = 0;
        for (let v = 0; v < 256; v++) {
          cumulative += hist[v];
          map[v] = (cumulative / pixels) * 255;
        }
      }
      for (let i = 0; i < pixels; i++) out[i * 4 + c] = map[out[i * 4 + c]];
    }
  }
}

// Rampe de chaleur pour l'entropie : sombre → sarcelle → ambre → rouge.
const RAMP: [number, [number, number, number]][] = [
  [0, [16, 35, 58]],
  [0.34, [31, 111, 120]],
  [0.67, [217, 176, 56]],
  [1, [229, 72, 77]],
];

function heat(t: number): [number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const k = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

function entropyMap(block: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const hist = new Uint32Array(256);
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      hist.fill(0);
      let count = 0;
      const yEnd = Math.min(by + block, height);
      const xEnd = Math.min(bx + block, width);
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const o = (y * width + x) * 4;
          const luma = (0.299 * src![o] + 0.587 * src![o + 1] + 0.114 * src![o + 2]) | 0;
          hist[luma]++;
          count++;
        }
      }
      let entropy = 0;
      for (let v = 0; v < 256; v++) {
        if (hist[v] === 0) continue;
        const p = hist[v] / count;
        entropy -= p * Math.log2(p);
      }
      const [r, g, b] = heat(Math.min(1, entropy / 8));
      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const o = (y * width + x) * 4;
          out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
        }
      }
    }
  }
  return out;
}

/**
 * Error Level Analysis : ré-encode l'image en JPEG à la qualité voulue, mesure
 * l'écart avec l'original et l'amplifie. Une zone retouchée, à un niveau de
 * compression différent du reste, ressort nettement.
 */
async function ela(quality: number, scale: number): Promise<Uint8ClampedArray> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('offscreen canvas');
  context.putImageData(new ImageData(new Uint8ClampedArray(src!), width, height), 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 });
  const bitmap = await createImageBitmap(blob);

  const canvas2 = new OffscreenCanvas(width, height);
  const context2 = canvas2.getContext('2d')!;
  context2.drawImage(bitmap, 0, 0);
  bitmap.close();
  const recompressed = context2.getImageData(0, 0, width, height).data;

  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    out[o] = Math.abs(src![o] - recompressed[o]) * scale;
    out[o + 1] = Math.abs(src![o + 1] - recompressed[o + 1]) * scale;
    out[o + 2] = Math.abs(src![o + 2] - recompressed[o + 2]) * scale;
    out[o + 3] = 255;
  }
  return out;
}

function compare(mode: 'diff' | 'xor' | 'overlay', opacity: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const ow = Math.min(width, width2);
  const oh = Math.min(height, height2);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const o1 = (y * width + x) * 4;
      const o2 = (y * width2 + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = src![o1 + c];
        const b = src2![o2 + c];
        out[o1 + c] = mode === 'diff' ? Math.abs(a - b) : mode === 'xor' ? (a ^ b) : (a * (1 - opacity) + b * opacity);
      }
      out[o1 + 3] = 255;
    }
  }
  return out;
}

/**
 * Balayage LSB automatique (façon zsteg) : essaie de nombreuses configurations
 * (bits × canaux × ordre × sens), et ne retient que celles qui révèlent une
 * signature de fichier ou une suite de texte imprimable.
 */
const SCAN_CHANNELS: { ch: Channel[]; name: string }[] = [
  { ch: [0], name: 'r' },
  { ch: [1], name: 'g' },
  { ch: [2], name: 'b' },
  { ch: [3], name: 'a' },
  { ch: [0, 1, 2], name: 'rgb' },
  { ch: [2, 1, 0], name: 'bgr' },
  { ch: [0, 1, 2, 3], name: 'rgba' },
];

function analyseScan(bytes: Uint8Array): Pick<LsbScanResult, 'kind' | 'preview' | 'score'> | null {
  const signature = matchAt(bytes, 0);
  if (signature) return { kind: 'file', preview: `file: ${signature.name}`, score: 1000 };
  let best = '';
  let current = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 0x20 && b <= 0x7E) {
      current += String.fromCharCode(b);
    }
    else {
      if (current.length > best.length) best = current;
      current = '';
    }
  }
  if (current.length > best.length) best = current;
  if (best.length >= 6) return { kind: 'text', preview: `text: ${best.slice(0, 90)}`, score: best.length };
  return null;
}

function lsbScan(limit: number): LsbScanResult[] {
  const results: LsbScanResult[] = [];
  for (const bits of [1, 2, 3]) {
    for (const set of SCAN_CHANNELS) {
      for (const msbFirst of [false, true]) {
        for (const column of [false, true]) {
          const found = analyseScan(lsb(set.ch, bits, msbFirst, column, limit));
          if (!found) continue;
          results.push({
            label: `b${bits},${set.name},${msbFirst ? 'msb' : 'lsb'},${column ? 'yx' : 'xy'}`,
            bits,
            channels: set.ch,
            msbFirst,
            column,
            ...found,
          });
        }
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 60);
}

// --- Réception ----------------------------------------------------------------

ctx.addEventListener('message', async (event: MessageEvent<StegoRequest>) => {
  const { id, op } = event.data;
  try {
    if (op.type === 'load') {
      src = new Uint8ClampedArray(op.data);
      width = op.width;
      height = op.height;
      reply({ id, type: 'loaded' });
      return;
    }
    if (op.type === 'loadSecond') {
      src2 = new Uint8ClampedArray(op.data);
      width2 = op.width;
      height2 = op.height;
      reply({ id, type: 'loaded2' });
      return;
    }
    if (!src) throw new Error('no image loaded');
    if (op.type === 'bitPlane') {
      result(id, bitPlane(op.channel, op.bit, op.colour));
    }
    else if (op.type === 'channel') {
      const out = channelView(op.view);
      enhance(out, op.enhance, op.level);
      result(id, out);
    }
    else if (op.type === 'entropy') {
      result(id, entropyMap(op.block));
    }
    else if (op.type === 'lsb') {
      const bytes = lsb(op.channels, op.bits, op.msbFirst, op.column, op.limit).slice();
      const buffer = bytes.buffer as ArrayBuffer;
      reply({ id, type: 'bytes', data: buffer }, [buffer]);
    }
    else if (op.type === 'lsbScan') {
      reply({ id, type: 'scan', results: lsbScan(op.limit) });
    }
    else if (op.type === 'ela') {
      result(id, await ela(op.quality, op.scale));
    }
    else if (op.type === 'compare') {
      if (!src2) throw new Error('no second image');
      result(id, compare(op.mode, op.opacity));
    }
  }
  catch (error) {
    reply({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
