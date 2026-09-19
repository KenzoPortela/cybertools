import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, normalize, relative } from 'node:path';
import { type Plugin, normalizePath } from 'vite';

/**
 * Remplace des fichiers de vendor/ par les nôtres, sans jamais toucher à vendor/.
 *
 * Convention : un fichier `src/overrides/it-tools/ui/theme/themes.ts` remplace
 * `vendor/it-tools/src/ui/theme/themes.ts`. Même chemin relatif, rien à déclarer.
 *
 * On intercepte le chemin *résolu* plutôt que le texte de l'import, parce que les
 * sources amont s'importent entre elles en relatif (`../theme/themes`) : un simple
 * alias sur `@/ui/theme/themes` passerait à côté de la plupart des imports.
 *
 * Si un fichier surchargé disparaît de vendor/ après un `git pull`, le build
 * échoue : une surcharge orpheline cesserait de s'appliquer sans que personne ne
 * s'en aperçoive.
 *
 * Chaque surcharge déclare l'empreinte du fichier amont qu'elle remplace, par un
 * commentaire `@upstream-sha256 <empreinte>`. Si l'original change en amont, un
 * avertissement le signale : la copie mérite d'être revue, elle risque de perdre
 * un correctif ou une fonctionnalité.
 */
export interface VendorOverride {
  /** Racine des sources amont, ex. vendor/it-tools/src */
  vendorRoot: string;
  /** Racine de nos remplacements, ex. src/overrides/it-tools */
  overridesRoot: string;
}

const key = (path: string) => {
  const normalised = normalize(path.split('?')[0]).replace(/\\/g, '/');
  return process.platform === 'win32' ? normalised.toLowerCase() : normalised;
};

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.vue']);

/**
 * Empreinte d'un fichier source, fins de ligne normalisées : un clone Windows
 * (autocrlf) est en CRLF, un clone Linux — celui du build Docker — en LF. Sans
 * normalisation, chaque surcharge passerait pour périmée d'un système à l'autre.
 */
export const sha256 = (path: string) =>
  createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const DECLARED_HASH = /@upstream-sha256\s+([0-9a-f]{64})/;

/**
 * Nom de fichier sans extension de script. Pas `extname` seul : pour un import
 * sans extension comme `./c-card.theme`, il renverrait `.theme`, et l'import ne
 * correspondrait plus au fichier `c-card.theme.ts`.
 */
const stem = (path: string) => {
  const name = basename(path.split('?')[0]);
  const ext = extname(name);
  return SCRIPT_EXTENSIONS.has(ext) ? name.slice(0, -ext.length) : name;
};

export function vendorOverrides(roots: VendorOverride[]): Plugin {
  /** chemin vendor normalisé → notre fichier */
  const replacements = new Map<string, string>();
  const orphans: string[] = [];
  /** Surcharges dont l'original a changé, ou qui ne déclarent pas d'empreinte. */
  const stale: string[] = [];
  /** Noms de fichiers concernés : un filtre bon marché avant toute résolution. */
  const stems = new Set<string>();
  const vendorRoots = roots.map(({ vendorRoot }) => key(vendorRoot));

  for (const { vendorRoot, overridesRoot } of roots) {
    for (const file of listFiles(overridesRoot)) {
      const target = join(vendorRoot, relative(overridesRoot, file));
      if (!existsSync(target)) {
        orphans.push(`${relative(process.cwd(), file)} → ${relative(process.cwd(), target)} (introuvable)`);
        continue;
      }
      // Identifiant renvoyé à Vite : chemin normalisé, avec des « / ». Avec les
      // « \ » de Windows, le template passait mais la sous-requête de style d'un
      // .vue n'était plus reconnue au build, et son CSS disparaissait.
      replacements.set(key(target), normalizePath(file));
      stems.add(stem(target));

      const current = sha256(target);
      const declared = readFileSync(file, 'utf8').match(DECLARED_HASH)?.[1];
      const where = relative(process.cwd(), file);
      if (!declared) {
        stale.push(`${where} : aucune empreinte déclarée — ajouter « @upstream-sha256 ${current} »`);
      }
      else if (declared !== current) {
        stale.push(`${where} : l'original a changé en amont — revoir la surcharge, puis déclarer « @upstream-sha256 ${current} »`);
      }
    }
  }

  return {
    name: 'cybertools:vendor-overrides',
    enforce: 'pre',

    // La liste des surcharges est établie au démarrage. En dev, ajouter ou
    // retirer une surcharge redémarre donc le serveur, faute de quoi elle
    // resterait sans effet jusqu'au prochain lancement.
    configureServer(server) {
      const overrideRoots = roots.map(({ overridesRoot }) => key(overridesRoot));
      server.watcher.add(roots.map(({ overridesRoot }) => overridesRoot));
      const onChange = (file: string) => {
        if (overrideRoots.some(root => key(file).startsWith(root))) {
          server.config.logger.info(`surcharge ajoutée ou retirée : ${relative(process.cwd(), file)} — redémarrage`);
          server.restart();
        }
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },

    buildStart() {
      if (orphans.length > 0) {
        this.error(
          `Surcharges sans fichier amont correspondant — vendor/ a probablement changé :\n  ${orphans.join('\n  ')}`,
        );
      }
      if (stale.length > 0) {
        this.warn(`Surcharges à revoir :\n  ${stale.join('\n  ')}`);
      }
      if (replacements.size > 0) {
        this.info(`${replacements.size} fichier(s) amont surchargé(s)`);
      }
    },

    async resolveId(source, importer, options) {
      if (!importer || replacements.size === 0) return null;

      // Seuls les imports issus de vendor/, ou visant vendor/ via `@/`, peuvent
      // atteindre un fichier surchargé. Tout le reste passe sans résolution.
      const fromVendor = vendorRoots.some(root => key(importer).startsWith(root));
      if (!fromVendor && !source.startsWith('@/')) return null;
      if (!stems.has(stem(source))) return null;

      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;

      return replacements.get(key(resolved.id)) ?? null;
    },
  };
}
