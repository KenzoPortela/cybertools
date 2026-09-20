/**
 * `strings` sur les octets bruts du fichier : suites de caractères imprimables
 * d'au moins `minLength`. Utile pour repérer un message, une URL ou un flag,
 * y compris dans des données ajoutées après l'image.
 */

export interface FoundString {
  offset: number;
  text: string;
}

const latin1 = new TextDecoder('latin1');

export function extractStrings(buffer: ArrayBuffer, minLength = 4, limit = 4000): FoundString[] {
  const bytes = new Uint8Array(buffer);
  const out: FoundString[] = [];
  let start = -1;

  const flush = (end: number) => {
    if (start >= 0 && end - start >= minLength) {
      out.push({ offset: start, text: latin1.decode(bytes.subarray(start, end)) });
    }
    start = -1;
  };

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    const printable = (byte >= 0x20 && byte <= 0x7E) || byte === 0x09;
    if (printable) {
      if (start < 0) start = i;
    }
    else {
      flush(i);
      if (out.length >= limit) return out;
    }
  }
  flush(bytes.length);
  return out.slice(0, limit);
}
