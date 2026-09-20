/**
 * Opérations pixel pures, utilisées côté thread principal pour les vignettes des
 * grilles (plans de bits, color remapping). Les analyses lourdes plein-écran
 * restent dans le Web Worker.
 */

/** Réduit une image à `maxDim` au plus grand côté, pour des vignettes rapides. */
export function makePreview(image: ImageData, maxDim = 240): ImageData {
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const source = document.createElement('canvas');
  source.width = image.width;
  source.height = image.height;
  source.getContext('2d')!.putImageData(image, 0, 0);
  const target = document.createElement('canvas');
  target.width = w;
  target.height = h;
  const ctx = target.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Convertit un `ImageData` en URL de données (pour un `<img>`). */
export function imageDataToUrl(image: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Plan de bits d'un canal, en niveaux de gris. */
export function bitPlaneImage(src: ImageData, channel: number, bit: number): ImageData {
  const out = new ImageData(src.width, src.height);
  const mask = 1 << bit;
  for (let i = 0; i < src.width * src.height; i++) {
    const on = (src.data[i * 4 + channel] & mask) !== 0 ? 255 : 0;
    const o = i * 4;
    out.data[o] = on;
    out.data[o + 1] = on;
    out.data[o + 2] = on;
    out.data[o + 3] = 255;
  }
  return out;
}

export interface Remap {
  id: string;
  out: (r: number, g: number, b: number) => [number, number, number];
}

/** Recompositions de couleur (color remapping) qui révèlent des canaux cachés. */
export const REMAPS: Remap[] = [
  { id: 'original', out: (r, g, b) => [r, g, b] },
  { id: 'invert', out: (r, g, b) => [255 - r, 255 - g, 255 - b] },
  { id: 'rbg', out: (r, g, b) => [r, b, g] },
  { id: 'grb', out: (r, g, b) => [g, r, b] },
  { id: 'gbr', out: (r, g, b) => [g, b, r] },
  { id: 'brg', out: (r, g, b) => [b, r, g] },
  { id: 'bgr', out: (r, g, b) => [b, g, r] },
  { id: 'red', out: r => [r, r, r] },
  { id: 'green', out: (_r, g) => [g, g, g] },
  { id: 'blue', out: (_r, _g, b) => [b, b, b] },
  { id: 'invRed', out: (r, g, b) => [255 - r, g, b] },
  { id: 'invGreen', out: (r, g, b) => [r, 255 - g, b] },
  { id: 'invBlue', out: (r, g, b) => [r, g, 255 - b] },
];

export function remapImage(src: ImageData, remap: Remap): ImageData {
  const out = new ImageData(src.width, src.height);
  for (let i = 0; i < src.width * src.height; i++) {
    const o = i * 4;
    const [r, g, b] = remap.out(src.data[o], src.data[o + 1], src.data[o + 2]);
    out.data[o] = r;
    out.data[o + 1] = g;
    out.data[o + 2] = b;
    out.data[o + 3] = 255;
  }
  return out;
}
