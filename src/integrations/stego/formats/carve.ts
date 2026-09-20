/**
 * Carving façon binwalk / foremost : repère les signatures de fichiers n'importe
 * où dans les octets, détecte les flux zlib, et permet d'extraire ce qui est
 * embarqué. Tout est local.
 */
import { unzlibSync } from 'fflate';
import { SIGNATURES, indexOfBytes } from '~/integrations/stego/formats/signatures';

export interface Finding {
  offset: number;
  description: string;
  kind: 'file' | 'zlib';
  ext?: string;
  /** Pour un flux zlib : taille décompressée. */
  inflatedLength?: number;
}

const MAX_FINDINGS = 200;

/** En-tête zlib valide : premier octet 0x78, et (CMF*256+FLG) multiple de 31. */
function isZlibHeader(a: number, b: number): boolean {
  return a === 0x78 && ((a << 8) | b) % 31 === 0;
}

export function carve(buffer: ArrayBuffer): Finding[] {
  const bytes = new Uint8Array(buffer);
  const findings: Finding[] = [];

  // Signatures de fichiers (au moins 3 octets : on évite le bruit).
  for (const sig of SIGNATURES) {
    if (sig.magic.length < 3) continue;
    let at = indexOfBytes(bytes, sig.magic, 0);
    let seen = 0;
    while (at >= 0 && findings.length < MAX_FINDINGS && seen < 8) {
      findings.push({ offset: at, description: sig.name, kind: 'file', ext: sig.ext });
      seen++;
      at = indexOfBytes(bytes, sig.magic, at + sig.magic.length);
    }
  }

  // Flux zlib (les données PNG IDAT en sont, mais aussi un fichier compressé caché).
  let zlibSeen = 0;
  for (let i = 0; i + 1 < bytes.length && zlibSeen < 12 && findings.length < MAX_FINDINGS; i++) {
    if (!isZlibHeader(bytes[i], bytes[i + 1])) continue;
    try {
      const inflated = unzlibSync(bytes.subarray(i));
      if (inflated.length > 16) {
        findings.push({ offset: i, description: 'Zlib compressed data', kind: 'zlib', inflatedLength: inflated.length });
        zlibSeen++;
      }
    }
    catch {
      // Faux positif : en-tête plausible mais flux illisible. On ignore.
    }
  }

  return findings.sort((a, b) => a.offset - b.offset);
}

/** Octets du fichier à partir d'un offset (extraction « à partir d'ici »). */
export function sliceFrom(buffer: ArrayBuffer, offset: number): ArrayBuffer {
  return buffer.slice(offset);
}

/** Flux zlib décompressé à partir d'un offset. */
export function inflateAt(buffer: ArrayBuffer, offset: number): Uint8Array {
  return unzlibSync(new Uint8Array(buffer, offset));
}
