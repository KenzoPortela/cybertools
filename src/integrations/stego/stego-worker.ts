/**
 * Web Worker du Stego Lab.
 *
 * Lot 1 : un simple aller-retour, pour prouver qu'un worker Vite tourne bien
 * sous la politique de sécurité du contenu servie en production
 * (`worker-src 'self' blob:`). Les vraies analyses pixel (plans de bits, LSB,
 * ELA…) viendront s'y greffer aux lots suivants, hors du thread principal.
 */

export interface StegoRequest {
  id: number;
  type: 'ping';
  width: number;
  height: number;
}

export interface StegoResponse {
  id: number;
  type: 'pong';
  /** Nombre de pixels annoncés : preuve que le worker a bien reçu et calculé. */
  pixels: number;
}

const ctx = self as unknown as Worker;

ctx.addEventListener('message', (event: MessageEvent<StegoRequest>) => {
  const message = event.data;
  if (message.type === 'ping') {
    const reply: StegoResponse = {
      id: message.id,
      type: 'pong',
      pixels: message.width * message.height,
    };
    ctx.postMessage(reply);
  }
});
