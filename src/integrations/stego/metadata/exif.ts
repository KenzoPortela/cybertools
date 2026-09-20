/**
 * Lecture des métadonnées (EXIF, GPS, IPTC, XMP, ICC…) via exifr (MIT), sans
 * aucune requête réseau : on ne passe que des octets déjà en mémoire. La CSP
 * (`connect-src 'self'`) interdirait de toute façon toute sortie.
 */
import { gps as exifrGps, parse as exifrParse } from 'exifr';

export interface MetaEntry {
  key: string;
  value: string;
}

export interface MetaGroup {
  id: string;
  entries: MetaEntry[];
}

export interface Metadata {
  groups: MetaGroup[];
  gps?: { latitude: number; longitude: number };
}

/** Segments qu'exifr renvoie quand on désactive la fusion (`mergeOutput: false`). */
const SEGMENTS = ['ifd0', 'exif', 'gps', 'interop', 'thumbnail', 'iptc', 'xmp', 'icc', 'jfif', 'ihdr'];

function toText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return `[${value.length} octets]`;
  if (Array.isArray(value)) return value.map(toText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export async function readMetadata(buffer: ArrayBuffer): Promise<Metadata> {
  const input = new Uint8Array(buffer);
  let raw: Record<string, unknown> | undefined;
  try {
    raw = await exifrParse(input, {
      mergeOutput: false,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      tiff: true,
      xmp: true,
      icc: true,
      iptc: true,
      jfif: true,
      ihdr: true,
      gps: true,
      interop: true,
    }) as Record<string, unknown> | undefined;
  }
  catch {
    raw = undefined;
  }

  const groups: MetaGroup[] = [];
  for (const id of SEGMENTS) {
    const segment = raw?.[id];
    if (!segment || typeof segment !== 'object') continue;
    const entries = Object.entries(segment as Record<string, unknown>)
      .map(([key, value]) => ({ key, value: toText(value) }))
      .filter(entry => entry.value !== '');
    if (entries.length) groups.push({ id, entries });
  }

  let coords: Metadata['gps'];
  try {
    const point = await exifrGps(input);
    if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
      coords = { latitude: point.latitude, longitude: point.longitude };
    }
  }
  catch {
    // Pas de GPS : cas courant.
  }

  return { groups, gps: coords };
}
