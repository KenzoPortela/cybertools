/**
 * Cacher et révéler un message dans une image, entièrement dans le navigateur.
 *
 * Trois méthodes : bits de poids faible (LSB), chunk texte PNG, ajout après la
 * fin du fichier. Chiffrement optionnel AES-GCM (clé dérivée du mot de passe par
 * PBKDF2). Le message est encadré par un en-tête auto-descriptif, pour que la
 * révélation soit déterministe (longueur + indicateur de chiffrement).
 *
 * L'extraction LSB reste compatible avec l'analyseur du Stego Lab (canaux RGB,
 * bit 0, LSB d'abord).
 */
import { crc32 } from '~/integrations/stego/formats/crc32';
import { indexOfBytes } from '~/integrations/stego/formats/signatures';

export type HideMethod = 'lsb' | 'text' | 'append';

const MAGIC = [0x43, 0x54, 0x53, 0x54, 0x45, 0x47, 0x31]; // « CTSTEG1 »
const HEADER_LENGTH = MAGIC.length + 1 + 4; // magic + flags + longueur (BE)
const CHUNK_KEYWORD = 'cybertools';

// --- Encadrement --------------------------------------------------------------

function frame(flags: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(HEADER_LENGTH + body.length);
  out.set(MAGIC, 0);
  out[MAGIC.length] = flags;
  new DataView(out.buffer).setUint32(MAGIC.length + 1, body.length);
  out.set(body, HEADER_LENGTH);
  return out;
}

interface Parsed {
  flags: number;
  body: Uint8Array;
}

function parseFrame(bytes: Uint8Array, offset = 0): Parsed {
  if (!MAGIC.every((b, i) => bytes[offset + i] === b)) throw new Error('no-message');
  const flags = bytes[offset + MAGIC.length];
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset + MAGIC.length + 1);
  const start = offset + HEADER_LENGTH;
  if (start + length > bytes.length) throw new Error('truncated');
  return { flags, body: bytes.subarray(start, start + length) };
}

// --- Chiffrement --------------------------------------------------------------

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

async function buildBody(message: string, password?: string): Promise<{ flags: number; body: Uint8Array }> {
  const plain = new TextEncoder().encode(message);
  if (!password) return { flags: 0, body: plain };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { flags: 1, body: concat(salt, iv, ct) };
}

async function readBody(flags: number, body: Uint8Array, password?: string): Promise<string> {
  if ((flags & 1) === 0) return new TextDecoder().decode(body);
  if (!password) throw new Error('password-required');
  const salt = body.subarray(0, 16);
  const iv = body.subarray(16, 28);
  const ct = body.subarray(28);
  const key = await deriveKey(password, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(plain);
  }
  catch {
    throw new Error('wrong-password');
  }
}

// --- LSB (pixels) -------------------------------------------------------------

/** Capacité en octets d'une image pour la méthode LSB (canaux RGB, 1 bit). */
export function lsbCapacity(image: ImageData): number {
  return Math.floor((image.width * image.height * 3) / 8) - HEADER_LENGTH;
}

function embedLsb(image: ImageData, payload: Uint8Array): ImageData {
  const out = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const d = out.data;
  let ci = 0;
  for (const byte of payload) {
    for (let k = 0; k < 8; k++) {
      const pixel = Math.floor(ci / 3);
      const channel = ci % 3;
      const o = pixel * 4 + channel;
      d[o] = (d[o] & 0xFE) | ((byte >> k) & 1);
      ci++;
    }
  }
  return out;
}

function extractLsb(image: ImageData, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let ci = 0;
  for (let i = 0; i < length; i++) {
    let byte = 0;
    for (let k = 0; k < 8; k++) {
      const pixel = Math.floor(ci / 3);
      const channel = ci % 3;
      byte |= (image.data[pixel * 4 + channel] & 1) << k;
      ci++;
    }
    out[i] = byte;
  }
  return out;
}

/** Encode un `ImageData` en octets PNG (sans perte : les LSB survivent). */
function imageToPng(image: ImageData): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('encode'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

function decodeImage(buffer: ArrayBuffer): Promise<ImageData> {
  // Décodage par un élément <img> : plus fiable que createImageBitmap, qui
  // renvoie parfois une image 0×0 juste après un ré-encodage canvas.
  const url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

// --- Chunk texte PNG ----------------------------------------------------------

const latin1 = new TextDecoder('latin1');

function pngTextChunk(keyword: string, text: string): Uint8Array {
  const kw = new TextEncoder().encode(keyword);
  const tx = new TextEncoder().encode(text);
  const data = concat(kw, new Uint8Array([0]), tx);
  const typed = concat(new TextEncoder().encode('tEXt'), data);
  const out = new Uint8Array(4 + typed.length + 4);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(typed, 4);
  new DataView(out.buffer).setUint32(4 + typed.length, crc32(typed));
  return out;
}

function insertTextChunk(buffer: ArrayBuffer, chunk: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(buffer);
  // IEND fait les 12 derniers octets d'un PNG.
  const iend = bytes.length - 12;
  return concat(bytes.subarray(0, iend), chunk, bytes.subarray(iend));
}

function findTextChunk(buffer: ArrayBuffer, keyword: string): Uint8Array | undefined {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let p = 8;
  while (p + 8 <= bytes.length) {
    const length = view.getUint32(p);
    const type = latin1.decode(bytes.subarray(p + 4, p + 8));
    const data = bytes.subarray(p + 8, p + 8 + length);
    if (type === 'tEXt') {
      const nul = data.indexOf(0);
      if (latin1.decode(data.subarray(0, nul)) === keyword) return data.subarray(nul + 1);
    }
    if (type === 'IEND') break;
    p = p + 8 + length + 4;
  }
  return undefined;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// --- API haut niveau ----------------------------------------------------------

export interface HideOptions {
  method: HideMethod;
  message: string;
  password?: string;
}

export async function hide(cover: { image: ImageData; buffer: ArrayBuffer }, options: HideOptions): Promise<Uint8Array> {
  const { flags, body } = await buildBody(options.message, options.password);
  const payload = frame(flags, body);

  if (options.method === 'lsb') {
    if (payload.length > lsbCapacity(cover.image) + HEADER_LENGTH) throw new Error('too-large');
    return imageToPng(embedLsb(cover.image, payload));
  }
  if (options.method === 'text') {
    return insertTextChunk(cover.buffer, pngTextChunk(CHUNK_KEYWORD, toBase64(payload)));
  }
  return concat(new Uint8Array(cover.buffer), payload);
}

export async function reveal(buffer: ArrayBuffer, method: HideMethod, password?: string): Promise<string> {
  let parsed: Parsed;
  if (method === 'lsb') {
    const image = await decodeImage(buffer);
    const header = extractLsb(image, HEADER_LENGTH);
    const length = new DataView(header.buffer).getUint32(MAGIC.length + 1);
    parsed = parseFrame(extractLsb(image, HEADER_LENGTH + length));
  }
  else if (method === 'text') {
    const chunk = findTextChunk(buffer, CHUNK_KEYWORD);
    if (!chunk) throw new Error('no-message');
    parsed = parseFrame(fromBase64(latin1.decode(chunk)));
  }
  else {
    const bytes = new Uint8Array(buffer);
    const at = indexOfBytes(bytes, MAGIC);
    if (at < 0) throw new Error('no-message');
    parsed = parseFrame(bytes, at);
  }
  return readBody(parsed.flags, parsed.body, password);
}
