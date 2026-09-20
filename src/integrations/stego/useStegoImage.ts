import { ref } from 'vue';

/**
 * Chargement et décodage d'une image, en mémoire, sans jamais l'envoyer nulle
 * part. Fournit à la fois les pixels décodés (`ImageData`, pour les analyses
 * des lots suivants) et les octets bruts du fichier (`buffer`, pour les
 * parseurs de format et la détection de données cachées).
 */

export interface StegoImage {
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
  /** Pixels décodés, plein-res. */
  data: ImageData;
  /** Octets bruts du fichier d'origine. */
  buffer: ArrayBuffer;
}

/** Code d'erreur, traduit par le composant (`app.stego.errors.<code>`). */
export type StegoError = 'read' | 'decode' | 'tooLarge';

/** Au-delà, le décodage risque d'épuiser la mémoire (surtout sur mobile). */
const MAX_PIXELS = 40_000_000;

export function useStegoImage() {
  const image = ref<StegoImage>();
  const busy = ref(false);
  const error = ref<StegoError>();

  async function load(file: File) {
    busy.value = true;
    error.value = undefined;

    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    }
    catch {
      error.value = 'read';
      busy.value = false;
      return;
    }

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(new Blob([buffer], file.type ? { type: file.type } : undefined));
    }
    catch {
      error.value = 'decode';
      busy.value = false;
      return;
    }

    try {
      if (bitmap.width * bitmap.height > MAX_PIXELS) {
        error.value = 'tooLarge';
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        error.value = 'decode';
        return;
      }
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
      image.value = {
        name: file.name,
        size: file.size,
        type: file.type || 'image/*',
        width: data.width,
        height: data.height,
        data,
        buffer,
      };
    }
    catch {
      error.value = 'decode';
    }
    finally {
      bitmap.close?.();
      busy.value = false;
    }
  }

  function clear() {
    image.value = undefined;
    error.value = undefined;
  }

  return { image, busy, error, load, clear };
}
