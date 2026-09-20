/**
 * Analyse de la structure d'un fichier image : format, chunks/segments, textes
 * cachés, données après la fin logique, fichiers embarqués (mini-binwalk),
 * polyglotte. Réunit les parseurs PNG/JPEG et la table de signatures.
 */
import { parseJpeg } from '~/integrations/stego/formats/jpeg';
import { type Chunk, type TextFinding, parsePng } from '~/integrations/stego/formats/png';
import { type Found, findContainers, matchAt } from '~/integrations/stego/formats/signatures';

export interface Trailing {
  offset: number;
  length: number;
  /** Signature reconnue au tout début des données ajoutées, s'il y en a une. */
  signature?: string;
}

export interface StructureReport {
  format?: string;
  chunks: Chunk[];
  texts: TextFinding[];
  logicalEnd?: number;
  trailing?: Trailing;
  embedded: Found[];
  polyglot: boolean;
}

/** Fin logique des formats sans parseur dédié (GIF, BMP, RIFF). */
function simpleLogicalEnd(bytes: Uint8Array, view: DataView): number | undefined {
  // GIF : se termine par le marqueur 0x3B.
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0x3B) return i + 1;
    }
  }
  // BMP : taille du fichier en octets 2..5 (petit-boutiste).
  if (bytes[0] === 0x42 && bytes[1] === 0x4D && bytes.length >= 6) {
    return view.getUint32(2, true);
  }
  // RIFF (WebP/WAV) : 8 + taille annoncée aux octets 4..7.
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes.length >= 8) {
    return 8 + view.getUint32(4, true);
  }
  return undefined;
}

export function analyseStructure(buffer: ArrayBuffer): StructureReport {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const top = matchAt(bytes, 0);

  let chunks: Chunk[] = [];
  let texts: TextFinding[] = [];
  let logicalEnd: number | undefined;

  if (top?.ext === 'png') {
    ({ chunks, texts, logicalEnd } = parsePng(bytes));
  }
  else if (top?.ext === 'jpg') {
    ({ chunks, texts, logicalEnd } = parseJpeg(bytes));
  }
  else {
    logicalEnd = simpleLogicalEnd(bytes, view);
  }

  let trailing: Trailing | undefined;
  if (logicalEnd !== undefined && logicalEnd < bytes.length) {
    const sig = matchAt(bytes, logicalEnd);
    trailing = { offset: logicalEnd, length: bytes.length - logicalEnd, signature: sig?.name };
  }

  // Conteneurs cachés au-delà de la fin logique (ou dès l'octet 1 si inconnue).
  const scanFrom = logicalEnd ?? 1;
  const embedded = findContainers(bytes, Math.max(1, scanFrom));

  const polyglot = embedded.length > 0 || Boolean(trailing?.signature);

  return { format: top?.name, chunks, texts, logicalEnd, trailing, embedded, polyglot };
}
