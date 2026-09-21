/**
 * Requêtes réseau vers un autre site que celui de l'application, comptées par
 * le navigateur lui-même.
 *
 * « Rien ne quitte le navigateur » est l'argument de cybertools : la barre
 * d'état l'affiche comme une mesure, pas comme un badge. On lit la chronologie
 * des ressources (Resource Timing), où le navigateur inscrit chaque requête
 * partie, et on retient celles dont l'origine n'est pas la nôtre.
 *
 * Ce que la mesure voit, et ce qu'elle ne voit pas :
 *  - une requête bloquée par la CSP (`connect-src 'self'`) n'est jamais partie :
 *    elle n'est pas inscrite, et elle n'est pas comptée ;
 *  - les workers (CyberChef, Stego Lab) ont leur propre chronologie, invisible
 *    d'ici. Ils ne chargent que leurs modules, servis par l'application, et la
 *    CSP s'applique à eux aussi ;
 *  - le tampon du navigateur garde 250 entrées. Ce module est importé en premier
 *    par main.ts et observe ensuite tout en direct ; seul un démarrage de plus de
 *    250 fichiers (le serveur de développement, pas le build) peut en perdre.
 */
import { readonly, ref } from 'vue';

const count = ref(0);
const origins = ref<string[]>([]);

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
  for (const entry of entries) {
    const origin = externalOrigin(entry.name);
    if (!origin) continue;
    count.value++;
    if (!origins.value.includes(origin)) origins.value = [...origins.value, origin];
  }
}

if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('resource')) {
  // `buffered` rejoue d'abord ce qui s'est passé avant cette ligne.
  new PerformanceObserver(list => record(list.getEntries())).observe({ type: 'resource', buffered: true });
}

/** Nombre de requêtes parties vers un autre site depuis l'ouverture de la page. */
export const externalRequests = readonly(count);
/** Les sites concernés, pour l'infobulle. */
export const externalOrigins = readonly(origins);
