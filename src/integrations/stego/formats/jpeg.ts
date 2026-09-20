/**
 * Parseur de segments JPEG (lecture seule) : liste les marqueurs et extrait les
 * commentaires (COM), autre cachette classique. On s'arrête au début des
 * données compressées (SOS) et on cherche la fin d'image (EOI).
 */
import { indexOfBytes } from '~/integrations/stego/formats/signatures';
import type { Chunk, TextFinding } from '~/integrations/stego/formats/png';

export interface JpegStructure {
  chunks: Chunk[];
  texts: TextFinding[];
  logicalEnd?: number;
}

const latin1 = new TextDecoder('latin1');

const APP_NAMES: Record<number, string> = {
  0xE0: 'APP0 (JFIF)',
  0xE1: 'APP1 (EXIF/XMP)',
  0xE2: 'APP2 (ICC)',
  0xED: 'APP13 (IPTC/Photoshop)',
  0xEE: 'APP14 (Adobe)',
};

function markerName(marker: number): string {
  if (marker in APP_NAMES) return APP_NAMES[marker];
  if (marker >= 0xE0 && marker <= 0xEF) return `APP${marker - 0xE0}`;
  if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) return 'SOF (frame)';
  switch (marker) {
    case 0xC4: return 'DHT (Huffman)';
    case 0xDB: return 'DQT (quant.)';
    case 0xDA: return 'SOS (scan)';
    case 0xFE: return 'COM (comment)';
    case 0xD9: return 'EOI';
    default: return `marker 0x${marker.toString(16).toUpperCase()}`;
  }
}

export function parseJpeg(bytes: Uint8Array): JpegStructure {
  const chunks: Chunk[] = [];
  const texts: TextFinding[] = [];
  let logicalEnd: number | undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 2; // saute SOI (FFD8)

  while (p + 1 < bytes.length) {
    if (bytes[p] !== 0xFF) {
      p++;
      continue;
    }
    let marker = bytes[p + 1];
    while (marker === 0xFF && p + 1 < bytes.length) {
      p++;
      marker = bytes[p + 1];
    }
    if (marker === 0xD9) {
      chunks.push({ name: 'EOI', offset: p, length: 2 });
      logicalEnd = p + 2;
      break;
    }
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      p += 2;
      continue;
    }
    if (p + 4 > bytes.length) break;
    const length = view.getUint16(p + 2);
    chunks.push({ name: markerName(marker), offset: p, length: length + 2 });

    if (marker === 0xFE) {
      texts.push({ source: 'COM', text: latin1.decode(bytes.subarray(p + 4, p + 2 + length)) });
    }
    if (marker === 0xDA) {
      // Données compressées : on cesse de découper et on cherche la fin d'image.
      break;
    }
    p += 2 + length;
  }

  if (logicalEnd === undefined) {
    // Dernière occurrence de EOI : ce qui suit est probablement ajouté.
    let last = -1;
    let at = indexOfBytes(bytes, [0xFF, 0xD9]);
    while (at >= 0) {
      last = at;
      at = indexOfBytes(bytes, [0xFF, 0xD9], at + 2);
    }
    if (last >= 0) logicalEnd = last + 2;
  }

  return { chunks, texts, logicalEnd };
}
