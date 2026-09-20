/**
 * Validation d'un PNG façon pngcheck : chaque chunk vérifié (CRC) et interprété,
 * erreurs signalées, verdict final.
 */
import { unzlibSync } from 'fflate';
import { crc32 } from '~/integrations/stego/formats/crc32';

export interface PngChunkInfo {
  name: string;
  offset: number;
  length: number;
  crcOk: boolean;
  note?: string;
}

export interface PngCheckReport {
  isPng: boolean;
  chunks: PngChunkInfo[];
  errors: string[];
  summary: string;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const latin1 = new TextDecoder('latin1');

const COLOUR_TYPES: Record<number, { label: string; channels: number }> = {
  0: { label: 'grayscale', channels: 1 },
  2: { label: 'RGB', channels: 3 },
  3: { label: 'palette', channels: 1 },
  4: { label: 'grayscale+alpha', channels: 2 },
  6: { label: 'RGB+alpha', channels: 4 },
};

const INTENTS = ['perceptual', 'relative colorimetric', 'saturation', 'absolute colorimetric'];

function interpret(type: string, data: Uint8Array, view: DataView, at: number): string | undefined {
  switch (type) {
    case 'IHDR': {
      const w = view.getUint32(at);
      const h = view.getUint32(at + 4);
      const depth = data[8];
      const colour = COLOUR_TYPES[data[9]];
      const interlace = data[12] ? 'interlaced' : 'non-interlaced';
      const bits = colour ? depth * colour.channels : depth;
      return `${w} x ${h}, ${bits}-bit ${colour?.label ?? `type ${data[9]}`}, ${interlace}`;
    }
    case 'sRGB':
      return `rendering intent = ${INTENTS[data[0]] ?? data[0]}`;
    case 'pHYs': {
      const x = view.getUint32(at);
      const y = view.getUint32(at + 4);
      const perMetre = data[8] === 1;
      const dpi = perMetre ? ` (${Math.round(x * 0.0254)} dpi)` : '';
      return `${x}x${y} pixels/${perMetre ? 'meter' : 'unit'}${dpi}`;
    }
    case 'gAMA':
      return `gamma = ${view.getUint32(at) / 100000}`;
    case 'tIME':
      return `${view.getUint16(at)}-${String(data[2]).padStart(2, '0')}-${String(data[3]).padStart(2, '0')} ${String(data[4]).padStart(2, '0')}:${String(data[5]).padStart(2, '0')}:${String(data[6]).padStart(2, '0')}`;
    case 'tEXt': {
      const nul = data.indexOf(0);
      return `${latin1.decode(data.subarray(0, nul))}: ${latin1.decode(data.subarray(nul + 1)).slice(0, 120)}`;
    }
    case 'zTXt': {
      const nul = data.indexOf(0);
      try {
        return `${latin1.decode(data.subarray(0, nul))}: ${latin1.decode(unzlibSync(data.subarray(nul + 2))).slice(0, 120)}`;
      }
      catch {
        return latin1.decode(data.subarray(0, nul));
      }
    }
    case 'PLTE':
      return `${data.length / 3} colours`;
    default:
      return undefined;
  }
}

export function pngcheck(buffer: ArrayBuffer): PngCheckReport {
  const bytes = new Uint8Array(buffer);
  const isPng = PNG_SIGNATURE.every((b, i) => bytes[i] === b);
  const chunks: PngChunkInfo[] = [];
  const errors: string[] = [];

  if (!isPng) {
    return { isPng: false, chunks, errors: ['Not a PNG file (bad signature).'], summary: '' };
  }

  const view = new DataView(buffer);
  let p = 8;
  let sawIHDR = false;
  let sawIEND = false;

  while (p + 8 <= bytes.length) {
    const length = view.getUint32(p);
    const type = latin1.decode(bytes.subarray(p + 4, p + 8));
    const dataStart = p + 8;
    if (dataStart + length + 4 > bytes.length) {
      errors.push(`Chunk ${type} at 0x${p.toString(16)} runs past end of file.`);
      break;
    }
    const data = bytes.subarray(dataStart, dataStart + length);
    const storedCrc = view.getUint32(dataStart + length);
    const crcOk = crc32(bytes.subarray(p + 4, dataStart + length)) === storedCrc;
    if (!crcOk) errors.push(`Bad CRC on chunk ${type} at 0x${p.toString(16)}.`);
    if (sawIEND) errors.push(`Chunk ${type} appears after IEND (trailing data).`);
    if (type === 'IHDR') sawIHDR = true;
    if (type === 'IEND') sawIEND = true;

    chunks.push({ name: type, offset: p, length, crcOk, note: interpret(type, data, view, dataStart) });
    p = dataStart + length + 4;
  }

  if (!sawIHDR) errors.push('Missing IHDR chunk.');
  if (!sawIEND) errors.push('Missing IEND chunk.');

  const summary = errors.length === 0
    ? `No errors detected (${chunks.length} chunks).`
    : `${errors.length} problem(s) detected.`;

  return { isPng, chunks, errors, summary };
}
