/**
 * Regards sur une donnée, pour les panneaux d'entrée et de sortie : vue
 * hexadécimale, entropie, format probable, différence entre deux textes.
 *
 * Tout est calculé ici, dans l'onglet, sans passer par le moteur CyberChef :
 * ce sont des indices d'affichage, instantanés, pas des opérations.
 */
import { matchAt } from '~/integrations/stego/formats/signatures';

const encoder = new TextEncoder();

export function toBytes(data: string | ArrayBuffer): Uint8Array {
  return typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
}

// --- Vue hexadécimale ---------------------------------------------------------

/** Au-delà, la vue hexadécimale se limiterait à défiler : on n'en montre que le début. */
export const HEX_LIMIT = 64 * 1024;

/** Vue « hexdump -C » : offset, seize octets, et leur lecture ASCII. */
export function hexdump(bytes: Uint8Array, limit = HEX_LIMIT): { text: string; truncated: boolean } {
  const shown = bytes.subarray(0, limit);
  const lines: string[] = [];
  for (let offset = 0; offset < shown.length; offset += 16) {
    const row = shown.subarray(offset, offset + 16);
    const hex = Array.from(row, byte => byte.toString(16).padStart(2, '0'));
    const ascii = Array.from(row, byte => (byte >= 0x20 && byte < 0x7F ? String.fromCharCode(byte) : '.')).join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.slice(0, 8).join(' ').padEnd(23)}  ${hex.slice(8).join(' ').padEnd(23)}  |${ascii}|`);
  }
  return { text: lines.join('\n'), truncated: bytes.length > limit };
}

// --- Entropie ---------------------------------------------------------------

/**
 * Entropie de Shannon, en bits par octet (0 à 8). Vers 4 pour du texte, près
 * de 6 pour du base64, près de 8 pour une donnée chiffrée ou compressée.
 */
export function entropy(bytes: Uint8Array): number {
  if (!bytes.length) return 0;
  const counts = new Uint32Array(256);
  for (const byte of bytes) counts[byte]++;
  let bits = 0;
  for (const count of counts) {
    if (!count) continue;
    const p = count / bytes.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

// --- Format probable ----------------------------------------------------------

const HEX = /^(?:[0-9a-f]{2}[\s:,-]?)+$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const URL_ENCODED = /%[0-9a-f]{2}/i;

/** Une couche décodée qui n'est plus du texte, sans signature connue. */
export const BINARY = 'binary';

function printable(bytes: Uint8Array) {
  const sample = bytes.subarray(0, 4096);
  let odd = 0;
  for (const byte of sample) {
    if (byte < 0x09 || (byte > 0x0D && byte < 0x20) || byte === 0x7F) odd++;
  }
  return sample.length > 0 && odd / sample.length < 0.02;
}

function fromHex(text: string) {
  const digits = text.replace(/[\s:,-]/g, '');
  const bytes = new Uint8Array(digits.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}

/**
 * Base64 plausible : assez long, bien aligné, et pas un simple mot — « password »
 * a la forme d'un base64 valide. On exige un mélange de casse ou de chiffres,
 * ou un bourrage.
 */
function looksLikeBase64(text: string) {
  if (text.length < 12 || text.length % 4 !== 0 || !BASE64.test(text)) return false;
  return text.endsWith('=') || (/[a-z]/.test(text) && /[A-Z]/.test(text)) || (/\d/.test(text) && /[a-z]/i.test(text));
}

/**
 * Ce à quoi une donnée ressemble, couche après couche : `['base64', 'GZIP']`.
 * Une supposition, affichée comme telle — c'est à Magic de décoder vraiment.
 */
export function sniff(data: Uint8Array, depth = 3): string[] {
  const chain: string[] = [];
  let current = data;

  for (let layer = 0; layer < depth && current.length; layer++) {
    const signature = matchAt(current, 0);
    if (signature) {
      chain.push(signature.name);
      break;
    }
    if (!printable(current)) {
      // Jeton neutre, traduit à l'affichage.
      if (layer > 0) chain.push(BINARY);
      break;
    }

    const text = new TextDecoder().decode(current.subarray(0, 1024 * 1024)).trim();
    if (!text) break;

    if ((text.startsWith('{') || text.startsWith('[')) && isJson(text)) {
      chain.push('JSON');
      break;
    }
    const compact = text.replace(/\s+/g, '');
    if (compact.length >= 4 && compact.length % 2 === 0 && HEX.test(text)) {
      chain.push('hex');
      current = fromHex(text);
      continue;
    }
    if (looksLikeBase64(compact)) {
      chain.push('base64');
      try {
        current = fromBase64(compact);
      }
      catch {
        break;
      }
      continue;
    }
    if (URL_ENCODED.test(text)) chain.push('URL');
    break;
  }
  return chain;
}

function isJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  }
  catch {
    return false;
  }
}

/** La valeur JSON d'un texte, ou `undefined` s'il n'en est pas. */
export function parseJson(text: string): { value: unknown } | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    return { value: JSON.parse(trimmed) };
  }
  catch {
    return undefined;
  }
}

// --- Différence ---------------------------------------------------------------

export interface DiffLine {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/**
 * Au-delà de ce produit de lignes, la table de la plus longue sous-suite
 * commune pèserait trop lourd : le diff n'est pas calculé.
 */
const DIFF_LIMIT = 4_000_000;

/** Différence ligne à ligne entre deux textes, ou `undefined` s'ils sont trop longs. */
export function lineDiff(before: string, after: string): DiffLine[] | undefined {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > DIFF_LIMIT) return undefined;

  // lcs[i][j] : longueur de la plus longue sous-suite commune de a[i..] et b[j..].
  const width = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i] === b[j]
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: 'same', text: a[i] });
      i++;
      j++;
    }
    else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      lines.push({ kind: 'removed', text: a[i++] });
    }
    else {
      lines.push({ kind: 'added', text: b[j++] });
    }
  }
  while (i < a.length) lines.push({ kind: 'removed', text: a[i++] });
  while (j < b.length) lines.push({ kind: 'added', text: b[j++] });
  return lines;
}
