/**
 * Requêtes réseau vers un autre site que celui de l'application, comptées par
 * le navigateur lui-même.
 *
 * « Rien ne quitte le navigateur » est l'argument de cybertools : la barre
 * d'état l'affiche comme une mesure, pas comme un badge. On lit la chronologie
 * des ressources (Resource Timing), où le navigateur inscrit chaque requête, et
 * on retient celles dont l'origine n'est pas la nôtre.
 *
 * Deux mesures, pas une : le navigateur inscrit aussi dans cette chronologie une
 * requête que la CSP a refusée — durée nulle, aucun octet —, alors qu'elle n'est
 * jamais partie. On écoute donc aussi les violations de la CSP
 * (`securitypolicyviolation`) : une requête inscrite et refusée est comptée comme
 * bloquée, pas comme envoyée. Une tentative déjouée reste une information.
 *
 * Ce que la mesure ne voit pas :
 *  - les workers (CyberChef, Stego Lab) ont leur propre chronologie, invisible
 *    d'ici. Ils ne chargent que leurs modules, servis par l'application, et la
 *    CSP s'applique à eux aussi ;
 *  - le tampon du navigateur garde 250 entrées. Ce module est importé en premier
 *    par main.ts et observe ensuite tout en direct ; seul un démarrage de plus de
 *    250 fichiers (le serveur de développement, pas le build) peut en perdre.
 */
import { computed, ref } from 'vue';

/** Adresses externes inscrites dans la chronologie, parties ou non. */
const seen = ref<string[]>([]);
/** Adresses externes refusées par la CSP. */
const refused = ref<string[]>([]);

function externalOrigin(url: string): string | undefined {
  try {
    const { protocol, origin } = new URL(url, location.href);
    if (protocol !== 'http:' && protocol !== 'https:') return undefined;
    return origin === location.origin ? undefined : origin;
  }
  catch {
    return undefined;
  }
}

function record(entries: PerformanceEntryList) {
  const external = entries.map(entry => entry.name).filter(url => externalOrigin(url));
  if (external.length) seen.value = [...seen.value, ...external];
}

if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('resource')) {
  // `buffered` rejoue d'abord ce qui s'est passé avant cette ligne.
  new PerformanceObserver(list => record(list.getEntries())).observe({ type: 'resource', buffered: true });
}

if (typeof document !== 'undefined') {
  document.addEventListener('securitypolicyviolation', (event) => {
    if (externalOrigin(event.blockedURI)) refused.value = [...refused.value, event.blockedURI];
  }, true);
}

/**
 * Les adresses réellement parties : celles de la chronologie, moins une
 * occurrence par refus de la CSP. Les deux signaux arrivent dans un ordre
 * quelconque ; le calcul, lui, ne dépend pas de l'ordre.
 */
const sent = computed(() => {
  const pending = new Map<string, number>();
  for (const url of refused.value) pending.set(url, (pending.get(url) ?? 0) + 1);
  return seen.value.filter((url) => {
    const left = pending.get(url) ?? 0;
    if (!left) return true;
    pending.set(url, left - 1);
    return false;
  });
});

/** Nombre de requêtes parties vers un autre site depuis l'ouverture de la page. */
export const externalRequests = computed(() => sent.value.length);
/** Nombre de requêtes vers un autre site que la CSP a empêchées de partir. */
export const blockedRequests = computed(() => refused.value.length);
/** Les sites effectivement contactés, pour l'infobulle. */
export const externalOrigins = computed(() => [...new Set(sent.value.map(url => externalOrigin(url)!))]);
