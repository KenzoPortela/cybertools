/**
 * Source CyberChef : ses opérations deviennent des outils du catalogue.
 *
 * L'index est généré par build/scripts/build-cyberchef.mjs depuis la
 * configuration de CyberChef, dans vendor/ : une opération ajoutée en amont
 * apparaît donc après un `git pull` et une reconstruction.
 */
import operations from '~/generated/cyberchef-operations.json';
import { type CategoryId, categoryById } from '~/catalog/categories';
import { OPERATION_KEYWORDS } from '~/catalog/synonyms';
import type { ToolDef } from '~/catalog/tool.types';

interface OperationIndexEntry {
  name: string;
  module: string;
  category: string;
  summary: string;
  flowControl: boolean;
}

/**
 * Opérations écartées du catalogue, avec la raison. Elles ne seront pas non plus
 * proposées dans les Recettes.
 */
export const EXCLUDED_OPERATIONS: Record<string, string> = {
  'HTTP request': 'envoie une requête, avec les données saisies, vers un serveur tiers',
  'DNS over HTTPS': 'envoie le nom recherché à un résolveur tiers (Google, Cloudflare)',
  'Show on map': 'charge Leaflet depuis unpkg.com et des tuiles OpenStreetMap, révélant la zone consultée',
  'Automated Validation Test Op': 'opération de test interne de CyberChef, sans usage',
};

/**
 * Doublons avec IT-Tools : la version IT-Tools est canonique (UX dédiée), et
 * les opérations équivalentes ne sont pas listées à part. Elles restent
 * accessibles depuis l'outil IT-Tools, via « Ouvrir dans les Recettes ».
 *
 * Ne sont listés que les équivalents réels. « AES Encrypt » n'est pas un
 * doublon de l'outil de chiffrement d'IT-Tools, par exemple : l'un dérive la
 * clé d'une phrase secrète, l'autre prend une clé et un IV explicites.
 */
export const DUPLICATES_OF_IT_TOOLS: Record<string, string[]> = {
  'base64-string-converter': ['To Base64', 'From Base64'],
  'hash-text': ['MD5', 'SHA1', 'SHA2', 'SHA3', 'RIPEMD'],
  'bcrypt': ['Bcrypt', 'Bcrypt compare'],
  'hmac-generator': ['HMAC'],
  'jwt-parser': ['JWT Decode'],
  'url-encoder': ['URL Encode', 'URL Decode'],
  'html-entities': ['To HTML Entity', 'From HTML Entity'],
  'uuid-generator': ['Generate UUID'],
  'lorem-ipsum-generator': ['Generate Lorem Ipsum'],
  'rsa-key-pair-generator': ['Generate RSA Key Pair'],
  'json-prettify': ['JSON Beautify'],
  'json-minify': ['JSON Minify'],
  'sql-prettify': ['SQL Beautify'],
  'xml-formatter': ['XML Beautify'],
  'yaml-to-json-converter': ['YAML to JSON'],
  'json-to-yaml-converter': ['JSON to YAML'],
  'json-to-csv': ['JSON to CSV'],
  'text-diff': ['Diff'],
  'user-agent-parser': ['Parse User Agent'],
  'url-parser': ['Parse URI'],
  'qrcode-generator': ['Generate QR Code'],
  'text-to-binary': ['To Binary', 'From Binary'],
  'text-to-nato-alphabet': ['Convert to NATO alphabet'],
  'otp-generator': ['Generate TOTP'],
  'ipv4-address-converter': ['Change IP format'],
  'base-converter': ['To Base', 'From Base'],
  'case-converter': ['To Upper case', 'To Lower case', 'To Camel case', 'To Kebab case', 'To Snake case'],
};

/** Catégories de CyberChef vers les nôtres. */
const CATEGORY_BY_UPSTREAM: Record<string, CategoryId> = {
  'Data format': 'encoding',
  'Encryption / Encoding': 'crypto',
  'Public Key': 'crypto',
  'Arithmetic / Logic': 'math',
  'Networking': 'network',
  'Language': 'text',
  'Utils': 'text',
  'Date / Time': 'misc',
  'Extractors': 'forensics',
  'Compression': 'data-formats',
  'Hashing': 'crypto',
  'Code tidy': 'web-dev',
  'Forensics': 'forensics',
  'Multimedia': 'media',
  'Other': 'misc',
};

/**
 * Corrections, là où la catégorie amont rangerait mal une opération : « Data
 * format » mêle encodages et vrais formats de données, « Other » mêle UUID,
 * entropie et TOTP.
 */
const CATEGORY_BY_OPERATION: Record<string, CategoryId> = {
  // Vrais formats de données, rangés par CyberChef avec les encodages ou ailleurs
  'To MessagePack': 'data-formats',
  'From MessagePack': 'data-formats',
  'CSV to JSON': 'data-formats',
  'Avro to JSON': 'data-formats',
  'CBOR Encode': 'data-formats',
  'CBOR Decode': 'data-formats',
  'Rison Encode': 'data-formats',
  'Rison Decode': 'data-formats',
  'AMF Encode': 'data-formats',
  'AMF Decode': 'data-formats',
  'Parse TLV': 'data-formats',
  'XML Minify': 'data-formats',
  'BSON serialise': 'data-formats',
  'BSON deserialise': 'data-formats',
  'PHP Serialize': 'data-formats',
  'PHP Deserialize': 'data-formats',
  'Jq': 'data-formats',
  'XPath expression': 'data-formats',
  'JPath expression': 'data-formats',
  'Jsonata Query': 'data-formats',
  'CSS selector': 'data-formats',
  'P-list Viewer': 'data-formats',
  'Protobuf Decode': 'data-formats',
  'Protobuf Encode': 'data-formats',
  'VarInt Encode': 'data-formats',
  'VarInt Decode': 'data-formats',

  // Crypto
  'PEM to Hex': 'crypto',
  'Hex to PEM': 'crypto',
  'Parse ASN.1 hex string': 'crypto',
  'Generate HOTP': 'crypto',

  // Analyse
  'Entropy': 'forensics',
  'Frequency distribution': 'forensics',
  'Index of Coincidence': 'forensics',
  'Chi Square': 'forensics',
  'Disassemble x86': 'forensics',
  'Disassemble ARM': 'forensics',

  // Maths et unités
  'Convert distance': 'math',
  'Convert area': 'math',
  'Convert mass': 'math',
  'Convert speed': 'math',
  'Convert data units': 'math',
  'Pseudo-Random Integer Generator': 'math',
  'Generate De Bruijn Sequence': 'math',
  'Haversine distance': 'math',

  // Web & dev
  'Analyse UUID': 'web-dev',
  'Parse UNIX file permissions': 'web-dev',

  // Texte
  'HTML To Text': 'text',
  'Template': 'text',
  'RAKE': 'text',

  // Images & médias
  'Parse QR Code': 'media',
  'Parse colour code': 'media',
};

/** « To Base64 » → « to-base64 », « Vigenère Encode » → « vigenere-encode ». */
export function operationSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const index = operations as OperationIndexEntry[];
const known = new Set(index.map(entry => entry.name));

if (import.meta.env.DEV) {
  // Une opération renommée ou retirée en amont rendrait ces tables silencieuses.
  const listed = [
    ...Object.keys(EXCLUDED_OPERATIONS),
    ...Object.values(DUPLICATES_OF_IT_TOOLS).flat(),
    ...Object.keys(CATEGORY_BY_OPERATION),
    ...Object.keys(OPERATION_KEYWORDS),
  ];
  for (const name of listed) {
    if (!known.has(name)) console.warn(`[catalogue] opération CyberChef inconnue dans nos tables : « ${name} »`);
  }
}

const duplicated = new Set(Object.values(DUPLICATES_OF_IT_TOOLS).flat());

/**
 * @param taken slugs déjà pris par d'autres sources. En cas de collision, le
 *              slug de l'opération reçoit le suffixe « -cyberchef » plutôt que
 *              de faire échouer le registre après une mise à jour amont.
 */
/**
 * Notre catégorie pour une opération CyberChef : la correction propre à
 * l'opération, sinon celle de sa catégorie amont. Sert au catalogue comme au
 * panneau d'opérations de l'atelier, pour qu'une opération soit rangée au même
 * endroit partout.
 */
export function operationCategory(entry: { name: string; category: string }): CategoryId {
  return CATEGORY_BY_OPERATION[entry.name] ?? CATEGORY_BY_UPSTREAM[entry.category] ?? 'misc';
}

export function cyberchefSource(taken: Set<string>): ToolDef[] {
  return index
    .filter(entry => !entry.flowControl && !(entry.name in EXCLUDED_OPERATIONS) && !duplicated.has(entry.name))
    .map((entry) => {
      const base = operationSlug(entry.name);
      const slug = taken.has(base) ? `${base}-cyberchef` : base;
      const category = operationCategory(entry);

      return {
        id: slug,
        slug,
        source: 'cyberchef',
        title: { keys: [`app.ops.${slug}.title`], fallback: entry.name },
        description: { keys: [`app.ops.${slug}.description`], fallback: entry.summary },
        category,
        keywords: [entry.category, ...(OPERATION_KEYWORDS[entry.name] ?? [])],
        icon: categoryById.get(category)?.icon,
        renderer: { kind: 'cc-op', op: entry.name },
      } satisfies ToolDef;
    });
}

/**
 * Pour chaque outil IT-Tools qui a un équivalent CyberChef, la recette
 * correspondante (arguments vides : les valeurs par défaut seront appliquées à
 * l'ouverture).
 */
export function recipeEquivalents(): Map<string, string[]> {
  return new Map(Object.entries(DUPLICATES_OF_IT_TOOLS));
}
