import { ref } from 'vue';
import StegoWorker from '~/integrations/stego/stego-worker?worker';
import type { StegoOp, StegoReply, StegoRequest } from '~/integrations/stego/stego-worker';

type Output = ImageData | Uint8Array | null;

/**
 * Client du Web Worker du Stego Lab. Charge l'image une fois dans le worker,
 * puis lance des calculs qui reviennent en `ImageData` (vues) ou en octets bruts
 * (extraction LSB). Un seul worker sert tous les panneaux.
 */
export class StegoEngine {
  private worker = new StegoWorker();
  private id = 0;
  private pending = new Map<number, { resolve: (value: Output) => void; reject: (error: Error) => void }>();

  /** Vrai quand une image est chargée dans le worker et prête à être analysée. */
  readonly ready = ref(false);

  constructor() {
    this.worker.addEventListener('message', (event: MessageEvent<StegoReply>) => {
      const message = event.data;
      const request = this.pending.get(message.id);
      if (message.type === 'loaded') {
        this.ready.value = true;
        request?.resolve(null);
      }
      else if (message.type === 'loaded2') {
        request?.resolve(null);
      }
      else if (message.type === 'result' && request) {
        request.resolve(new ImageData(new Uint8ClampedArray(message.data), message.width, message.height));
      }
      else if (message.type === 'bytes' && request) {
        request.resolve(new Uint8Array(message.data));
      }
      else if (message.type === 'error' && request) {
        request.reject(new Error(message.message));
      }
      this.pending.delete(message.id);
    });
  }

  /** Copie les pixels vers le worker (le thread principal garde les siens). */
  load(image: ImageData) {
    this.ready.value = false;
    const copy = image.data.slice();
    const buffer = copy.buffer as ArrayBuffer;
    return this.send({ type: 'load', width: image.width, height: image.height, data: buffer }, [buffer]);
  }

  /** Charge la seconde image (comparaison), sans toucher à `ready`. */
  loadSecond(image: ImageData) {
    const copy = image.data.slice();
    const buffer = copy.buffer as ArrayBuffer;
    return this.send({ type: 'loadSecond', width: image.width, height: image.height, data: buffer }, [buffer]);
  }

  /** Vue image (plan de bits, canal, entropie, ELA, comparaison). */
  run(op: Exclude<StegoOp, { type: 'load' | 'loadSecond' | 'lsb' }>): Promise<ImageData> {
    return this.send(op) as Promise<ImageData>;
  }

  /** Extraction d'octets bruts (LSB). */
  runBytes(op: Extract<StegoOp, { type: 'lsb' }>): Promise<Uint8Array> {
    return this.send(op) as Promise<Uint8Array>;
  }

  private send(op: StegoOp, transfer: Transferable[] = []) {
    const id = ++this.id;
    return new Promise<Output>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, op } satisfies StegoRequest, transfer);
    });
  }

  terminate() {
    this.worker.terminate();
    this.pending.clear();
  }
}
