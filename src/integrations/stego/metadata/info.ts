/**
 * Informations et statistiques de l'image (équivalent de « identify » + infos
 * de base) : format, dimensions, profondeur, DPI, empreintes, nombre de
 * couleurs, et statistiques par canal. Tout est calculé localement.
 */
import SparkMD5 from 'spark-md5';
import { matchAt } from '~/integrations/stego/formats/signatures';
import type { StegoImage } from '~/integrations/stego/useStegoImage';

export interface ChannelStat {
  name: string;
  min: number;
  max: number;
  mean: number;
  std: number;
  entropy: number;
}

export interface ImageInfo {
  format?: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  bitDepth?: number;
  colourType?: string;
  dpi?: number;
  colourCount: string;
  channels: ChannelStat[];
}

const COLOUR_TYPES: Record<number, string> = {
  0: 'Grayscale',
  2: 'RGB',
  3: 'Indexed',
  4: 'Grayscale + alpha',
  6: 'RGBA',
};

/** Détails PNG (profondeur, type de couleur, DPI) tirés d'IHDR et de pHYs. */
function pngDetails(bytes: Uint8Array): Pick<ImageInfo, 'bitDepth' | 'colourType' | 'dpi'> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Pick<ImageInfo, 'bitDepth' | 'colourType' | 'dpi'> = {};
  let p = 8;
  while (p + 8 <= bytes.length) {
    const length = view.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const data = p + 8;
    if (type === 'IHDR') {
      out.bitDepth = bytes[data + 8];
      out.colourType = COLOUR_TYPES[bytes[data + 9]] ?? `type ${bytes[data + 9]}`;
    }
    else if (type === 'pHYs') {
      const x = view.getUint32(data);
      if (bytes[data + 8] === 1) out.dpi = Math.round(x * 0.0254);
    }
    if (type === 'IEND') break;
    p = data + length + 4;
  }
  return out;
}

export function computeInfo(image: StegoImage): ImageInfo {
  const bytes = new Uint8Array(image.buffer);
  const signature = matchAt(bytes, 0);

  const histograms = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const data = image.data.data;
  const pixels = image.width * image.height;
  const colours = new Set<number>();
  const COLOUR_CAP = 200_000;
  let capped = false;

  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    for (let c = 0; c < 4; c++) histograms[c][data[o + c]]++;
    if (!capped) {
      colours.add(((data[o] << 24) | (data[o + 1] << 16) | (data[o + 2] << 8) | data[o + 3]) >>> 0);
      if (colours.size >= COLOUR_CAP) capped = true;
    }
  }

  const names = ['Red', 'Green', 'Blue', 'Alpha'];
  const channels: ChannelStat[] = histograms.map((hist, c) => {
    let min = 255;
    let max = 0;
    let sum = 0;
    let sumSq = 0;
    let entropy = 0;
    for (let v = 0; v < 256; v++) {
      const n = hist[v];
      if (n === 0) continue;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v * n;
      sumSq += v * v * n;
      const p = n / pixels;
      entropy -= p * Math.log2(p);
    }
    const mean = sum / pixels;
    const variance = Math.max(0, sumSq / pixels - mean * mean);
    return { name: names[c], min, max, mean, std: Math.sqrt(variance), entropy };
  });

  return {
    format: signature?.name,
    mime: image.type,
    width: image.width,
    height: image.height,
    size: image.size,
    ...(signature?.ext === 'png' ? pngDetails(bytes) : {}),
    colourCount: capped ? `${COLOUR_CAP}+` : String(colours.size),
    channels,
  };
}

export async function computeHashes(buffer: ArrayBuffer): Promise<{ md5: string; sha1: string; sha256: string }> {
  const toHex = (data: ArrayBuffer) => [...new Uint8Array(data)].map(b => b.toString(16).padStart(2, '0')).join('');
  const [sha1, sha256] = await Promise.all([
    crypto.subtle.digest('SHA-1', buffer),
    crypto.subtle.digest('SHA-256', buffer),
  ]);
  return {
    md5: SparkMD5.ArrayBuffer.hash(buffer),
    sha1: toHex(sha1),
    sha256: toHex(sha256),
  };
}
