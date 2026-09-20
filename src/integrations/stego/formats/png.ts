/**
 * Parseur de chunks PNG (lecture seule). Liste les chunks et extrait les
 * chunks texte (tEXt/zTXt/iTXt) — cachette fréquente d'un message.
 */
import { unzlibSync } from 'fflate';

export interface Chunk {
  name: string;
  offset: number;
  /** Longueur totale du chunk sur le disque (longueur + type + données + CRC). */
  length: number;
}

export interface TextFinding {
  source: string;
  text: string;
}

export interface PngStructure {
  chunks: Chunk[];
  texts: TextFinding[];
  /** Offset juste après le chunk IEND : fin logique du PNG. */
  logicalEnd?: number;
}

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');

function splitNull(data: Uint8Array, from: number): [string, number] {
  let end = from;
  while (end < data.length && data[end] !== 0) end++;
  return [latin1.decode(data.subarray(from, end)), end + 1];
}

function decodeTextChunk(type: string, data: Uint8Array): TextFinding {
  const [keyword, afterKeyword] = splitNull(data, 0);
  if (type === 'tEXt') {
    return { source: keyword || 'tEXt', text: latin1.decode(data.subarray(afterKeyword)) };
  }
  if (type === 'zTXt') {
    // afterKeyword pointe sur la méthode de compression (1 octet), puis les données.
    const compressed = data.subarray(afterKeyword + 1);
    return { source: keyword || 'zTXt', text: latin1.decode(unzlibSync(compressed)) };
  }
  // iTXt : keyword \0 compFlag(1) compMethod(1) lang \0 transKeyword \0 texte (UTF-8)
  const compFlag = data[afterKeyword];
  let p = afterKeyword + 2;
  [, p] = splitNull(data, p); // langue
  [, p] = splitNull(data, p); // mot-clé traduit
  const payload = data.subarray(p);
  const text = compFlag === 1 ? utf8.decode(unzlibSync(payload)) : utf8.decode(payload);
  const [translatedKeyword] = splitNull(data, 0);
  return { source: translatedKeyword || 'iTXt', text };
}

export function parsePng(bytes: Uint8Array): PngStructure {
  const chunks: Chunk[] = [];
  const texts: TextFinding[] = [];
  let logicalEnd: number | undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8; // saute la signature PNG

  while (p + 8 <= bytes.length) {
    const length = view.getUint32(p);
    const type = latin1.decode(bytes.subarray(p + 4, p + 8));
    const dataStart = p + 8;
    if (dataStart + length + 4 > bytes.length) break;
    chunks.push({ name: type, offset: p, length: length + 12 });

    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      try {
        texts.push(decodeTextChunk(type, bytes.subarray(dataStart, dataStart + length)));
      }
      catch {
        // Chunk texte illisible : on l'ignore sans casser le reste.
      }
    }

    p = dataStart + length + 4;
    if (type === 'IEND') {
      logicalEnd = p;
      break;
    }
  }

  return { chunks, texts, logicalEnd };
}
