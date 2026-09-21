/**
 * Client du worker CyberChef.
 *
 * Le worker est leur ChefWorker.js, construit par build/scripts/build-cyberchef.mjs
 * et servi depuis public/cyberchef/. On parle son protocole de messages tel quel
 * (`bake` → `bakeComplete` | `bakeError`).
 *
 * Tout le calcul reste dans le navigateur : le worker ne fait aucune requête,
 * hormis le chargement de ses propres modules d'opérations, servis par
 * l'application elle-même.
 */
import { ref } from 'vue';
import type { RecipeStep } from '~/catalog/tool.types';

export interface BakeResult {
  /** Octets bruts de la sortie, sauf pour une sortie HTML. */
  bytes?: ArrayBuffer;
  /** Présent quand l'opération produit du HTML (tableaux, images, graphiques…). */
  html?: string;
  /** Type de la sortie selon CyberChef : string, byteArray, html, JSON… */
  type: string;
  duration: number;
  /** Message d'erreur de l'opération, le cas échéant. */
  error?: string;
  /** Index de l'étape en échec dans la recette, quand error est présent. */
  failedStep?: number;
  /**
   * Index de l'étape où la recette s'est arrêtée sans lever d'erreur. Dans
   * CyberChef, une erreur d'opération (clé de mauvaise taille, par exemple)
   * devient la sortie et arrête la recette : c'est la seule trace qu'il en reste.
   */
  stoppedAt?: number;
  /**
   * Valeur brute, avant présentation, quand le résultat est du JSON — c'est le
   * cas de Magic, dont la liste de candidats est sinon mise en forme en HTML.
   */
  raw?: unknown;
}

/**
 * Ce que le worker a réellement calculé, pour les compteurs de session : une
 * exécution terminée, même si son résultat a ensuite été écarté au profit d'une
 * plus récente — le travail, lui, a bien eu lieu.
 */
export interface BakeRecord {
  /** Opérations exécutées : les étapes actives, jusqu'à celle qui a arrêté la recette. */
  operations: number;
  inputBytes: number;
  outputBytes: number;
  duration: number;
  failed: boolean;
}

/** Longueur en octets d'un texte encodé en UTF-8, sans le recopier. */
export function utf8Length(text: string) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    // Paire de substitution : un caractère de 4 octets sur deux unités.
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

/** Type « JSON » dans l'énumération des Dish de CyberChef (src/core/Dish.mjs). */
const DISH_JSON = 6;

/** Levée quand une demande est remplacée par une plus récente ou annulée. */
export class BakeSuperseded extends Error {
  constructor() {
    super('superseded');
  }
}

interface Request {
  id: number;
  input: string | ArrayBuffer;
  recipe: RecipeStep[];
  resolve: (result: BakeResult) => void;
  reject: (error: unknown) => void;
}

const WORKER_URL = `${import.meta.env.BASE_URL}cyberchef/chef-worker.js`;

class ChefClient {
  /** Message d'état du worker (« Chargement du module Ciphers »…), vide au repos. */
  readonly status = ref('');
  readonly busy = ref(false);

  private worker?: Worker;
  private ready?: Promise<Worker>;
  private current?: Request;
  private queued?: Request;
  private nextId = 1;
  private replies = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private bakedListeners = new Set<(record: BakeRecord) => void>();

  /** Prévient à chaque exécution terminée par le worker. Renvoie de quoi se désabonner. */
  onBaked(listener: (record: BakeRecord) => void) {
    this.bakedListeners.add(listener);
    return () => this.bakedListeners.delete(listener);
  }

  /**
   * Exécute une recette sur une entrée. Si un calcul est déjà en cours, la
   * demande attend son tour ; une demande plus récente la remplace alors, et
   * celle-ci est rejetée avec BakeSuperseded.
   */
  bake(input: string | ArrayBuffer, recipe: RecipeStep[]): Promise<BakeResult> {
    return new Promise((resolve, reject) => {
      const request: Request = { id: this.nextId++, input, recipe, resolve, reject };
      if (this.current) {
        this.queued?.reject(new BakeSuperseded());
        this.queued = request;
      }
      else {
        this.start(request);
      }
    });
  }

  /** Recette au format « pretty » de CyberChef, celui de ses liens de partage. */
  prettyRecipe(recipe: RecipeStep[]): Promise<string> {
    return this.call('cybertools:pretty-recipe', { recipe: JSON.parse(JSON.stringify(recipe)) }) as Promise<string>;
  }

  /** Lit une recette au format « pretty » ou JSON. Lève une erreur si elle est invalide. */
  parseRecipe(text: string): Promise<RecipeStep[]> {
    return this.call('cybertools:parse-recipe', { text }) as Promise<RecipeStep[]>;
  }

  private async call(action: string, payload: Record<string, unknown>): Promise<unknown> {
    const worker = await this.getWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.replies.set(id, { resolve, reject });
      worker.postMessage({ action, data: { ...payload, id } });
    });
  }

  /** Interrompt le calcul en cours : le worker est arrêté, puis recréé au besoin. */
  cancel() {
    this.queued?.reject(new BakeSuperseded());
    this.current?.reject(new BakeSuperseded());
    this.queued = undefined;
    this.current = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = undefined;
    for (const reply of this.replies.values()) reply.reject(new BakeSuperseded());
    this.replies.clear();
    this.busy.value = false;
    this.status.value = '';
  }

  private start(request: Request) {
    this.current = request;
    this.busy.value = true;

    this.getWorker()
      .then((worker) => {
        // Une annulation a pu survenir pendant le démarrage du worker.
        if (this.current !== request) return;
        worker.postMessage({
          action: 'bake',
          data: {
            input: request.input,
            // Une recette est du JSON par nature ; l'aller-retour retire les Proxy
            // réactifs de Vue, que postMessage refuse de cloner.
            recipeConfig: JSON.parse(JSON.stringify(request.recipe)),
            // Sans returnType, CyberChef renvoie un ArrayBuffer (ou du HTML) :
            // on garde ainsi les octets exacts, et le texte est décodé ici.
            options: {},
            id: request.id,
          },
        });
      })
      .catch(error => this.finish(request, () => request.reject(error)));
  }

  private finish(request: Request, settle: () => void) {
    if (this.current !== request) return;
    settle();
    this.current = undefined;
    this.busy.value = false;

    const next = this.queued;
    this.queued = undefined;
    if (next) this.start(next);
  }

  private report(request: Request, data: { result: unknown; type: string; duration: number; error: unknown; progress: unknown }) {
    if (!this.bakedListeners.size) return;
    const { recipe, input } = request;
    // CyberChef rend l'index de l'étape où il s'est arrêté ; elle a été exécutée.
    const stopped = typeof data.progress === 'number' && data.progress < recipe.length;
    const end = stopped ? (data.progress as number) + 1 : recipe.length;
    const record: BakeRecord = {
      operations: recipe.slice(0, end).filter(step => !step.disabled).length,
      inputBytes: typeof input === 'string' ? utf8Length(input) : input.byteLength,
      outputBytes: data.result instanceof ArrayBuffer
        ? data.result.byteLength
        : data.type === 'html' ? utf8Length(String(data.result)) : 0,
      duration: data.duration ?? 0,
      failed: Boolean(data.error),
    };
    for (const listener of this.bakedListeners) listener(record);
  }

  private getWorker(): Promise<Worker> {
    if (this.ready) return this.ready;

    this.ready = new Promise<Worker>((resolve, reject) => {
      const worker = new Worker(WORKER_URL);
      this.worker = worker;

      worker.addEventListener('error', (event) => {
        // On oublie ce worker : la prochaine demande retentera un démarrage au
        // lieu de réutiliser indéfiniment une promesse en échec.
        this.worker = undefined;
        this.ready = undefined;
        reject(new Error(`Impossible de démarrer le moteur CyberChef : ${event.message || WORKER_URL}`));
      });

      worker.addEventListener('message', ({ data: message }) => {
        switch (message.action) {
          case 'workerLoaded':
            resolve(worker);
            break;

          case 'bakeComplete': {
            const request = this.current;
            if (!request || message.data.id !== request.id) return;
            const { result, type, duration, error, progress, dish } = message.data;
            this.report(request, { result, type, duration, error, progress });
            this.finish(request, () => request.resolve({
              bytes: result instanceof ArrayBuffer ? result : undefined,
              html: type === 'html' ? String(result) : undefined,
              type,
              duration,
              error: error ? String(error.displayStr ?? error) : undefined,
              failedStep: error ? progress : undefined,
              stoppedAt: !error && typeof progress === 'number' && progress < request.recipe.length ? progress : undefined,
              raw: dish?.type === DISH_JSON ? dish.value : undefined,
            }));
            break;
          }

          case 'bakeError': {
            const request = this.current;
            if (!request || message.data.id !== request.id) return;
            this.finish(request, () => request.resolve({
              type: 'error',
              duration: 0,
              error: String(message.data.error?.displayStr ?? message.data.error),
            }));
            break;
          }

          case 'cybertools:reply': {
            const reply = this.replies.get(message.data.id);
            if (!reply) return;
            this.replies.delete(message.data.id);
            if (message.data.error) reply.reject(new Error(message.data.error));
            else reply.resolve(message.data.value);
            break;
          }

          case 'statusMessage':
            this.status.value = message.data.message ?? '';
            break;

          // optionUpdate, setRegisters, progressMessage : sans usage pour l'instant.
        }
      });
    });

    return this.ready;
  }
}

/** Instance unique : un seul worker pour toute l'application. */
export const chefClient = new ChefClient();
