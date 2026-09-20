import { ref } from 'vue';
import StegoWorker from '~/integrations/stego/stego-worker?worker';
import type { StegoOp, StegoReply, StegoRequest } from '~/integrations/stego/stego-worker';

/**
 * Client du Web Worker du Stego Lab. Charge l'image une fois dans le worker,
 * puis lance des calculs qui reviennent en `ImageData` prêts à afficher. Un
 * seul worker sert tous les panneaux.
 */
export class StegoEngine {
  private worker = new StegoWorker();
  private id = 0;
  private pending = new Map<number, { resolve: (value: ImageData | null) => void; reject: (error: Error) => void }>();

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
      else if (message.type === 'result' && request) {
        request.resolve(new ImageData(new Uint8ClampedArray(message.data), message.width, message.height));
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

  run(op: Exclude<StegoOp, { type: 'load' }>): Promise<ImageData> {
    return this.send(op) as Promise<ImageData>;
  }

  private send(op: StegoOp, transfer: Transferable[] = []) {
    const id = ++this.id;
    return new Promise<ImageData | null>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, op } satisfies StegoRequest, transfer);
    });
  }

  terminate() {
    this.worker.terminate();
    this.pending.clear();
  }
}
