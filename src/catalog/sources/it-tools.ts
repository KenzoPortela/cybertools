/**
 * Source IT-Tools : transforme leur registre d'outils en ToolDef.
 *
 * On lit `toolsWithCategory` directement depuis vendor/ — pas de copie de leur
 * liste, donc un outil ajouté en amont apparaît ici après un simple `git pull`.
 * Leur chemin (`/base64-string-converter`) devient notre identifiant : c'est aussi
 * lui qui forme leurs clés de traduction.
 */
import { toolsWithCategory } from '@/tools';
import type { CategoryId } from '~/catalog/categories';
import type { ToolDef } from '~/catalog/tool.types';

/**
 * Rangement de chaque outil dans NOS catégories. Leurs catégories ne suffisent
 * pas : « Converter » mélange Base64 (encodage), YAML → JSON (formats de données)
 * et chiffres romains (maths).
 */
const CATEGORY_BY_TOOL: Record<string, CategoryId> = {
  // Encodage
  'base64-string-converter': 'encoding',
  'base64-file-converter': 'encoding',
  'base-converter': 'encoding',
  'text-to-nato-alphabet': 'encoding',
  'text-to-binary': 'encoding',
  'text-to-unicode': 'encoding',
  'url-encoder': 'encoding',
  'html-entities': 'encoding',

  // Crypto & hash
  'token-generator': 'crypto',
  'hash-text': 'crypto',
  'bcrypt': 'crypto',
  'encryption': 'crypto',
  'bip39-generator': 'crypto',
  'hmac-generator': 'crypto',
  'rsa-key-pair-generator': 'crypto',
  'password-strength-analyser': 'crypto',
  'otp-generator': 'crypto',
  'jwt-parser': 'crypto',

  // Réseau
  'ipv4-subnet-calculator': 'network',
  'ipv4-address-converter': 'network',
  'ipv4-range-expander': 'network',
  'mac-address-lookup': 'network',
  'mac-address-generator': 'network',
  'ipv6-ula-generator': 'network',
  'random-port-generator': 'network',

  // Texte
  'case-converter': 'text',
  'slugify-string': 'text',
  'lorem-ipsum-generator': 'text',
  'text-statistics': 'text',
  'emoji-picker': 'text',
  'string-obfuscator': 'text',
  'text-diff': 'text',
  'numeronym-generator': 'text',
  'ascii-text-drawer': 'text',
  'regex-tester': 'text',
  'regex-memo': 'text',

  // Formats de données
  'yaml-to-json-converter': 'data-formats',
  'yaml-to-toml': 'data-formats',
  'json-to-yaml-converter': 'data-formats',
  'json-to-toml': 'data-formats',
  'toml-to-json': 'data-formats',
  'toml-to-yaml': 'data-formats',
  'xml-to-json': 'data-formats',
  'json-to-xml': 'data-formats',
  'json-to-csv': 'data-formats',
  'json-prettify': 'data-formats',
  'json-minify': 'data-formats',
  'json-diff': 'data-formats',
  'yaml-prettify': 'data-formats',
  'xml-formatter': 'data-formats',
  'sql-prettify': 'data-formats',
  'markdown-to-html': 'data-formats',
  'list-converter': 'data-formats',

  // Web & dev
  'uuid-generator': 'web-dev',
  'ulid-generator': 'web-dev',
  'url-parser': 'web-dev',
  'device-information': 'web-dev',
  'basic-auth-generator': 'web-dev',
  'og-meta-generator': 'web-dev',
  'mime-types': 'web-dev',
  'keycode-info': 'web-dev',
  'html-wysiwyg-editor': 'web-dev',
  'user-agent-parser': 'web-dev',
  'http-status-codes': 'web-dev',
  'safelink-decoder': 'web-dev',
  'git-memo': 'web-dev',
  'crontab-generator': 'web-dev',
  'chmod-calculator': 'web-dev',
  'docker-run-to-docker-compose-converter': 'web-dev',
  'email-normalizer': 'web-dev',
  'benchmark-builder': 'web-dev',

  // Forensique
  'pdf-signature-checker': 'forensics',

  // Images & médias
  'qrcode-generator': 'media',
  'wifi-qrcode-generator': 'media',
  'svg-placeholder-generator': 'media',
  'camera-recorder': 'media',
  'color-converter': 'media',

  // Maths & unités
  'math-evaluator': 'math',
  'eta-calculator': 'math',
  'percentage-calculator': 'math',
  'chronometer': 'math',
  'temperature-converter': 'math',
  'roman-numeral-converter': 'math',

  // Divers
  'date-converter': 'misc',
  'phone-parser-and-formatter': 'misc',
  'iban-validator-and-parser': 'misc',
};

/** Repli par catégorie d'IT-Tools, pour un outil ajouté en amont et pas encore rangé. */
const CATEGORY_BY_UPSTREAM: Record<string, CategoryId> = {
  'Crypto': 'crypto',
  'Converter': 'encoding',
  'Web': 'web-dev',
  'Images and videos': 'media',
  'Development': 'web-dev',
  'Network': 'network',
  'Math': 'math',
  'Measurement': 'math',
  'Text': 'text',
  'Data': 'misc',
};

export function itToolsSource(): ToolDef[] {
  return toolsWithCategory.map((tool) => {
    const slug = tool.path.replace(/^\//, '');

    let category = CATEGORY_BY_TOOL[slug];
    if (!category) {
      category = CATEGORY_BY_UPSTREAM[tool.category] ?? 'misc';
      if (import.meta.env.DEV) {
        console.warn(`[catalogue] outil IT-Tools non rangé : « ${slug} » (${tool.category}) → ${category} par défaut. À ajouter dans CATEGORY_BY_TOOL.`);
      }
    }

    return {
      id: slug,
      slug,
      source: 'it-tools',
      title: { keys: [`app.tools.${slug}.title`, `tools.${slug}.title`], fallback: tool.name },
      description: { keys: [`app.tools.${slug}.description`, `tools.${slug}.description`], fallback: tool.description },
      category,
      keywords: tool.keywords ?? [],
      icon: tool.icon,
      renderer: { kind: 'vue', component: tool.component },
      // Leurs URL d'origine continuent de fonctionner.
      aliases: [tool.path, ...(tool.redirectFrom ?? [])],
      createdAt: tool.createdAt,
    } satisfies ToolDef;
  });
}
