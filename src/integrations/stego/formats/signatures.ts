/**
 * Signatures de fichiers (« magic bytes »), pour reconnaître un format et
 * repérer un fichier caché dans un autre (mini-binwalk).
 */

export interface Signature {
  name: string;
  ext: string;
  magic: number[];
  /** Vrai pour les formats « conteneurs » : leur présence à un offset > 0 trahit un fichier caché. */
  container?: boolean;
}

export const SIGNATURES: Signature[] = [
  { name: 'PNG image', ext: 'png', magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { name: 'JPEG image', ext: 'jpg', magic: [0xFF, 0xD8, 0xFF] },
  { name: 'GIF image', ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] },
  { name: 'BMP image', ext: 'bmp', magic: [0x42, 0x4D] },
  { name: 'RIFF (WebP/WAV/AVI)', ext: 'riff', magic: [0x52, 0x49, 0x46, 0x46] },
  { name: 'PDF document', ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46], container: true },
  { name: 'ZIP archive', ext: 'zip', magic: [0x50, 0x4B, 0x03, 0x04], container: true },
  { name: 'ZIP (central directory)', ext: 'zip', magic: [0x50, 0x4B, 0x05, 0x06], container: true },
  { name: 'RAR archive', ext: 'rar', magic: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], container: true },
  { name: '7-Zip archive', ext: '7z', magic: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], container: true },
  { name: 'GZIP', ext: 'gz', magic: [0x1F, 0x8B, 0x08], container: true },
  { name: 'BZIP2', ext: 'bz2', magic: [0x42, 0x5A, 0x68], container: true },
  { name: 'ELF executable', ext: 'elf', magic: [0x7F, 0x45, 0x4C, 0x46], container: true },
  { name: 'OGG', ext: 'ogg', magic: [0x4F, 0x67, 0x67, 0x53] },
  { name: 'Java class', ext: 'class', magic: [0xCA, 0xFE, 0xBA, 0xBE] },
];

export function matchAt(bytes: Uint8Array, at: number): Signature | undefined {
  return SIGNATURES.find(sig => sig.magic.every((byte, i) => bytes[at + i] === byte));
}

/** Première position de `needle` dans `hay` à partir de `from`, ou -1. */
export function indexOfBytes(hay: Uint8Array, needle: number[], from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export interface Found {
  name: string;
  ext: string;
  offset: number;
}

/**
 * Cherche des signatures de conteneurs à partir de `from` (typiquement après la
 * fin logique de l'image) : une archive ou un PDF glissé là est le signe d'un
 * fichier caché. Une seule occurrence par signature suffit à alerter.
 */
export function findContainers(bytes: Uint8Array, from = 0): Found[] {
  const found: Found[] = [];
  for (const sig of SIGNATURES) {
    if (!sig.container) continue;
    const at = indexOfBytes(bytes, sig.magic, from);
    if (at >= 0) found.push({ name: sig.name, ext: sig.ext, offset: at });
  }
  return found.sort((a, b) => a.offset - b.offset);
}
