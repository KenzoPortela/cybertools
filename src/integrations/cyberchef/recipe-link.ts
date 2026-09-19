/**
 * Liens de partage au format de CyberChef : `#recipe=<recette>&input=<entrée>`.
 *
 * Un lien produit ici s'ouvre tel quel sur cyberchef.org, et un lien de
 * cyberchef.org s'ouvre ici — il suffit de remplacer le début de l'adresse.
 *
 *  - `recipe` : la recette au format « pretty », produit et lu par le worker
 *    (leur propre implémentation, voir build/cyberchef/worker-extensions.js) ;
 *  - `input`  : l'entrée, en base64 de ses octets UTF-8, comme chez eux.
 *
 * Le fragment (#…) n'est jamais envoyé au serveur par le navigateur : même une
 * entrée incluse dans un lien ne quitte pas la machine tant qu'on ne la partage
 * pas soi-même.
 */

/**
 * Caractères que CyberChef laisse en clair dans ses liens, pour des recettes
 * lisibles (Utils.encodeURIFragment, src/core/Utils.mjs).
 */
const LEGAL_CHARS: Record<string, string> = {
  '%2D': '-',
  '%2E': '.',
  '%5F': '_',
  '%7E': '~',
  '%21': '!',
  '%24': '$',
  '%27': '\'',
  '%28': '(',
  '%29': ')',
  '%2A': '*',
  '%2C': ',',
  '%3B': ';',
  '%3A': ':',
  '%40': '@',
  '%2F': '/',
  '%3F': '?',
};

export function encodeFragment(value: string) {
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, match => LEGAL_CHARS[match] ?? match);
}

export function inputToBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  // Par tranches : String.fromCharCode(...grandTableau) dépasse la pile.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function inputFromBase64(base64: string) {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export interface LinkState {
  /** Recette au format « pretty » (ou JSON), non encore interprétée. */
  recipe?: string;
  input?: string;
}

/** Lit `#recipe=…&input=…`, d'une URL complète ou d'un simple fragment. */
export function parseLink(text: string): LinkState {
  const hashIndex = text.indexOf('#');
  const fragment = hashIndex >= 0 ? text.slice(hashIndex + 1) : text;
  const state: LinkState = {};

  for (const pair of fragment.split('&')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator);
    const value = decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, '%20'));
    if (key === 'recipe') state.recipe = value;
    if (key === 'input') {
      try {
        state.input = inputFromBase64(value);
      }
      catch {
        // Entrée illisible : on garde la recette, qui reste utile seule.
      }
    }
  }

  return state;
}

export function buildFragment({ recipe, input }: { recipe?: string; input?: string }) {
  const params: string[] = [];
  if (recipe) params.push(`recipe=${encodeFragment(recipe)}`);
  if (input) params.push(`input=${encodeFragment(inputToBase64(input))}`);
  return params.join('&');
}

/** Un texte collé ressemble-t-il à un lien, plutôt qu'à une recette brute ? */
export function looksLikeLink(text: string) {
  return /(^|#|&)recipe=/.test(text.trim());
}
