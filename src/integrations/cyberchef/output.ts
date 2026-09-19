/**
 * Mise en forme des sorties CyberChef pour l'affichage.
 */
import DOMPurify from 'dompurify';

/** Au-delà, la zone de texte deviendrait poussive : on tronque l'affichage, pas le téléchargement. */
const DISPLAY_LIMIT = 512 * 1024;

export interface DecodedOutput {
  text: string;
  /** Le contenu ne ressemble pas à du texte : mieux vaut le télécharger. */
  binary: boolean;
  truncated: boolean;
  size: number;
}

const decoder = new TextDecoder('utf-8', { fatal: false });

/**
 * Décode une sortie en UTF-8. Une sortie binaire se décode en caractères de
 * remplacement et de contrôle : au-delà de 10 % de tels caractères, on la
 * signale comme binaire.
 */
export function decodeOutput(bytes: ArrayBuffer): DecodedOutput {
  const size = bytes.byteLength;
  const truncated = size > DISPLAY_LIMIT;
  const text = decoder.decode(truncated ? bytes.slice(0, DISPLAY_LIMIT) : bytes);

  let suspicious = 0;
  const sample = text.slice(0, 4096);
  for (const char of sample) {
    const code = char.codePointAt(0)!;
    if (code === 0xFFFD || (code < 0x20 && code !== 0x09 && code !== 0x0A && code !== 0x0D)) suspicious++;
  }

  return { text, binary: sample.length > 0 && suspicious / sample.length > 0.1, truncated, size };
}

/**
 * Les opérations à sortie HTML (tableaux, rendus d'image, graphiques) passent
 * par DOMPurify : scripts et gestionnaires d'événements sont retirés. Les images
 * en data: et les graphiques SVG, dessinés dans le worker, sont conservés.
 *
 * Les <canvas> sont retirés : quelques opérations (Entropy en mode « Shannon
 * scale », Frequency distribution, Index of Coincidence) les dessinent avec un
 * script qui dépend de l'interface de CyberChef elle-même — CodeMirror,
 * CanvasComponents, jQuery. Il ne pourrait pas tourner ici ; privés de lui, ces
 * canvas ne seraient que des rectangles vides.
 */
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['canvas'],
  });
}

export function downloadBytes(data: ArrayBuffer | string, filename: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} ko`;
  return `${(size / 1024 / 1024).toFixed(1)} Mo`;
}
