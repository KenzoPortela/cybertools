/**
 * Réparation PNG façon PCRT (sous-ensemble) : rétablit la signature et recalcule
 * les CRC erronés des chunks. Corrige les corruptions les plus courantes en
 * CTF. Ne prétend pas retrouver des dimensions perdues (limite assumée).
 */
import { crc32 } from '~/integrations/stego/formats/crc32';

export interface RepairResult {
  log: string[];
  changed: boolean;
  output: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const latin1 = new TextDecoder('latin1');

export function repairPng(buffer: ArrayBuffer): RepairResult {
  const bytes = new Uint8Array(buffer.slice(0));
  const view = new DataView(bytes.buffer);
  const log: string[] = [];
  let changed = false;

  // Signature.
  const sigOk = PNG_SIGNATURE.every((b, i) => bytes[i] === b);
  if (!sigOk) {
    PNG_SIGNATURE.forEach((b, i) => { bytes[i] = b; });
    changed = true;
    log.push('Fixed PNG signature.');
  }
  else {
    log.push('PNG signature OK.');
  }

  let p = 8;
  while (p + 8 <= bytes.length) {
    const length = view.getUint32(p);
    const type = latin1.decode(bytes.subarray(p + 4, p + 8));
    const dataEnd = p + 8 + length;
    if (dataEnd + 4 > bytes.length) {
      log.push(`Chunk ${type} at 0x${p.toString(16)} is truncated — stopping.`);
      break;
    }
    const computed = crc32(bytes.subarray(p + 4, dataEnd));
    const stored = view.getUint32(dataEnd);
    if (computed !== stored) {
      view.setUint32(dataEnd, computed);
      changed = true;
      log.push(`Corrected ${type} CRC at 0x${dataEnd.toString(16)}.`);
    }
    else {
      log.push(`${type} chunk OK at 0x${p.toString(16)}.`);
    }
    p = dataEnd + 4;
    if (type === 'IEND') break;
  }

  log.push(changed ? 'PNG repaired.' : 'Nothing to repair.');
  return { log, changed, output: bytes };
}
