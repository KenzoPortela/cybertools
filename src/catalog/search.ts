/**
 * Moteur de recherche commun : accueil, palette de commandes, atelier de recettes.
 *
 * Une recherche floue sur la phrase entière (Fuse.js) échoue dès que la requête
 * et le nom divergent un peu : « caeser cipher » ne trouvait pas « Caesar Box
 * Cipher », parce que le mot « box » manquant et la faute de frappe s'ajoutaient.
 * Ici, chaque mot de la requête est cherché séparément, dans n'importe quel
 * ordre, avec des fautes de frappe tolérées selon sa longueur :
 *
 *   - un résultat qui contient tous les mots passe devant ;
 *   - à défaut, un résultat auquel ne manque qu'un mot reste proposé, à
 *     condition que les autres figurent dans son nom ou ses mots-clés ;
 *   - les mots-outils (« to », « de »…) départagent sans être exigés : « to hex »
 *     classe To Hex devant From Hex, sans exiger « to » partout.
 *
 * Les mots de la requête passent aussi par un dictionnaire d'équivalences
 * (français → termes de CyberChef, orthographes britanniques) : « déchiffrer »
 * trouve « Decrypt », « color » trouve « colour ».
 */

/** Minuscules, sans accents : « Réseau » et « reseau » doivent se trouver l'un l'autre. */
export function normalizeForSearch(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SearchField {
  text: string | readonly string[] | undefined;
  /**
   * Importance du champ. À partir de 2 (nom, mots-clés), il accepte les fautes de
   * frappe et suffit à retenir un résultat partiel ; en dessous (description,
   * catégorie), seule une correspondance franche compte : une faute rapprochée
   * d'un mot quelconque d'une longue description ne serait que du bruit.
   */
  weight: number;
  /** Le champ porte le nom affiché : bonus quand il contient toute la requête. */
  title?: boolean;
}

const STRONG = 2;

const STOPWORDS = new Set([
  'to', 'from', 'the', 'a', 'an', 'of', 'and', 'or', 'in', 'for', 'with', 'by',
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'un', 'une', 'en', 'et', 'ou', 'pour', 'au', 'aux', 'a',
]);

/**
 * Équivalences appliquées aux mots de la requête. Un mot peut en évoquer
 * plusieurs ; le meilleur l'emporte. Les clés sont normalisées (sans accents).
 */
const WORD_EQUIVALENTS: Record<string, string[]> = {
  chiffrer: ['encrypt', 'encode', 'cipher'],
  chiffrement: ['encrypt', 'cipher', 'encryption'],
  dechiffrer: ['decrypt', 'decode'],
  dechiffrement: ['decrypt', 'decryption'],
  chiffre: ['cipher'],
  encoder: ['encode'],
  encodage: ['encode', 'encoding'],
  decoder: ['decode'],
  decodage: ['decode'],
  hacher: ['hash'],
  hachage: ['hash'],
  empreinte: ['hash', 'fingerprint', 'checksum'],
  compresser: ['compress'],
  compression: ['compress'],
  decompresser: ['decompress', 'inflate'],
  aleatoire: ['random'],
  generer: ['generate', 'generator'],
  generateur: ['generate', 'generator'],
  horodatage: ['timestamp'],
  date: ['time', 'timestamp'],
  couleur: ['colour', 'color'],
  color: ['colour'],
  colour: ['color'],
  serialize: ['serialise'],
  deserialize: ['deserialise'],
  analyser: ['parse', 'analyse'],
  analyze: ['analyse'],
  cle: ['key'],
  cles: ['key'],
  motdepasse: ['password'],
  majuscules: ['upper'],
  minuscules: ['lower'],
  inverser: ['reverse'],
  trier: ['sort'],
  extraire: ['extract'],
  remplacer: ['replace'],
  image: ['image', 'picture'],
  certificat: ['certificate', 'x509'],
  adresse: ['address'],
  reseau: ['network'],
  binaire: ['binary'],
  hexadecimal: ['hex'],
  hexa: ['hex'],
  texte: ['text'],
  fichier: ['file'],
  signature: ['signature', 'sign'],
  signer: ['sign'],
  verifier: ['verify'],
};

// --- Distance d'édition -------------------------------------------------------

/**
 * Distance de Damerau-Levenshtein restreinte (une transposition de lettres
 * voisines compte pour une faute : « caeser » / « caesar »). Abandonne dès que
 * la distance dépasse `max`.
 */
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previousPrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previousPrevious[j - 2] + 1);
      }
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

/** Fautes tolérées selon la longueur du mot tapé. */
function allowedTypos(length: number) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

/**
 * Qualité de la correspondance entre un mot de la requête et un mot indexé,
 * de 0 (aucune) à 1 (identique).
 */
function wordMatch(query: string, word: string, fuzzy: boolean) {
  if (query === word) return 1;
  if (word.startsWith(query)) return query.length === 1 ? 0.45 : 0.85;
  if (query.length >= 3 && word.includes(query)) return 0.6;
  if (!fuzzy) return 0;
  const max = allowedTypos(query.length);
  if (max === 0) return 0;
  const distance = editDistance(query, word, max);
  if (distance <= max) return 0.8 - 0.15 * distance;
  // Mot en cours de frappe, avec une faute : « caese » → « caesar ».
  if (word.length > query.length && query.length >= 4) {
    const prefixDistance = editDistance(query, word.slice(0, query.length), 1);
    if (prefixDistance <= 1) return 0.55;
  }
  return 0;
}

// --- Indexation ---------------------------------------------------------------

/**
 * Mots d'un texte. Les mots mêlant lettres et chiffres sont aussi découpés
 * (« rot13 » → « rot », « 13 »), et les paires de mots voisins recollées
 * (« Base 64 » → « base64 ») : « rot 13 » et « base64 » trouvent leur outil.
 */
function words(text: string) {
  const parts = normalizeForSearch(text).split(/[^a-z0-9]+/).filter(Boolean);
  const result = new Set(parts);
  for (const part of parts) {
    for (const piece of part.split(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)) result.add(piece);
  }
  for (let i = 0; i + 1 < parts.length; i++) result.add(parts[i] + parts[i + 1]);
  return [...result];
}

interface IndexedField {
  words: string[];
  weight: number;
  title: boolean;
  /** Texte complet normalisé, pour le bonus de phrase. */
  phrase: string;
  /** Premier mot du nom : un nom qui commence par le mot cherché passe devant. */
  firstWord: string;
}

interface QueryToken {
  variants: string[];
  stopword: boolean;
}

function parseQuery(query: string): QueryToken[] {
  const parts = normalizeForSearch(query).split(/[^a-z0-9]+/).filter(Boolean);
  // « mot de passe » : l'équivalence porte sur l'expression entière.
  const joined = parts.join('');
  const tokens = parts.map(part => ({
    variants: [part, ...(WORD_EQUIVALENTS[part] ?? [])],
    stopword: STOPWORDS.has(part) && parts.length > 1,
  }));
  if (parts.length > 1 && WORD_EQUIVALENTS[joined]) {
    return [{ variants: [joined, ...WORD_EQUIVALENTS[joined]], stopword: false }];
  }
  return tokens;
}

export function createSearchIndex<T>(items: readonly T[], fields: (item: T) => SearchField[]) {
  const indexed = items.map(item => ({
    item,
    fields: fields(item)
      .filter(field => field.text !== undefined)
      .map((field): IndexedField => {
        const texts = typeof field.text === 'string' ? [field.text] : [...(field.text as readonly string[])];
        const phrase = texts.map(normalizeForSearch).join(' | ');
        return {
          words: [...new Set(texts.flatMap(words))],
          weight: field.weight,
          title: field.title ?? false,
          phrase,
          firstWord: phrase.split(/[^a-z0-9]+/).filter(Boolean)[0] ?? '',
        };
      }),
  }));

  function search(query: string, limit = 50): T[] {
    const tokens = parseQuery(query);
    if (!tokens.length) return [];
    const required = tokens.filter(token => !token.stopword);
    const phrase = normalizeForSearch(query.trim()).replace(/\s+/g, ' ');

    const scored: { item: T; tier: number; score: number; order: number }[] = [];

    indexed.forEach((entry, order) => {
      let score = 0;
      let matched = 0;
      let matchedStrong = 0;

      let opening = 0;

      for (const token of tokens) {
        let best = 0;
        let bestStrong = 0;
        // À égalité, un résultat où le mot revient ailleurs (mots-clés,
        // description) est plus pertinent : petit bonus pour chaque champ
        // secondaire qui le contient.
        let echoes = 0;
        for (const field of entry.fields) {
          const fuzzy = field.weight >= STRONG;
          let fieldBest = 0;
          for (const variant of token.variants) {
            for (const word of field.words) {
              const quality = wordMatch(variant, word, fuzzy);
              if (quality === 0) continue;
              // Le mot tapé compte plein ; ses équivalences un peu moins, et
              // d'autant moins qu'elles viennent loin dans la liste — « chiffrer »
              // évoque d'abord encrypt, ensuite encode, enfin cipher.
              const rank = token.variants.indexOf(variant);
              const value = quality * field.weight * (rank === 0 ? 1 : 0.95 - 0.05 * (rank - 1));
              if (value > fieldBest) fieldBest = value;
            }
          }
          if (fieldBest > best) best = fieldBest;
          if (fuzzy && fieldBest > bestStrong) bestStrong = fieldBest;
          if (!field.title) echoes += fieldBest;
          // « Encrypt / decrypt text » avant « Blowfish Encrypt » : à égalité de
          // correspondance, l'outil dont le nom s'ouvre sur le mot cherché est
          // le plus probablement celui qu'on veut.
          if (field.title && fieldBest > 0 && token.variants.some(variant => field.firstWord === variant)) opening += 1;
        }
        score += best + 0.15 * echoes;
        if (!token.stopword) {
          if (best > 0) matched++;
          if (bestStrong > 0) matchedStrong++;
        }
      }

      const needed = required.length;
      let tier = 0;
      if (needed === 0 ? score > 0 : matched === needed) tier = 2;
      else if (needed >= 2 && matchedStrong >= needed - 1) tier = 1;
      if (tier === 0) return;

      // Toute la requête dans le nom : le meilleur des titres (traduit ou
      // d'origine) compte, sans cumul.
      let phraseBonus = 0;
      for (const field of entry.fields) {
        if (!field.title) continue;
        if (field.phrase === phrase) phraseBonus = Math.max(phraseBonus, 6);
        else if (field.phrase.startsWith(phrase)) phraseBonus = Math.max(phraseBonus, 3);
        else if (phrase.length >= 3 && field.phrase.includes(phrase)) phraseBonus = Math.max(phraseBonus, 1.5);
      }
      score += phraseBonus + 0.6 * opening;

      scored.push({ item: entry.item, tier, score, order });
    });

    return scored
      .sort((a, b) => b.tier - a.tier || b.score - a.score || a.order - b.order)
      .slice(0, limit)
      .map(result => result.item);
  }

  return { search };
}
