/**
 * Configuration des opérations CyberChef et valeurs par défaut de leurs
 * arguments.
 *
 * La configuration complète (arguments, description HTML) pèse 106 ko gzip :
 * elle n'est chargée qu'à l'ouverture d'une opération, pas avec l'application.
 */
/** Un argument d'opération, tel que décrit dans OperationConfig.json. */
export interface ArgConfig {
  name: string;
  type: string;
  value: unknown;
  toggleValues?: string[];
  defaultIndex?: number;
  hint?: string;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  /** populateOption : index (ou indices) de l'argument à préremplir. */
  target?: number | number[];
  maxLength?: number;
}

export interface OperationConfig {
  module: string;
  description: string;
  infoURL: string | null;
  inputType: string;
  outputType: string;
  flowControl: boolean;
  manualBake: boolean;
  args: ArgConfig[];
}

/** Choix d'une liste à sélection : `name` affiché, `value` utilisée. */
export interface NamedValue<T = unknown> {
  name: string;
  value: T;
  on?: number[];
  off?: number[];
}

/** Valeur d'un argument toggleString : un texte et son encodage. */
export interface ToggleString {
  string: string;
  option: string;
}

let configPromise: Promise<Record<string, OperationConfig>> | undefined;

export function loadOperationConfig(): Promise<Record<string, OperationConfig>> {
  configPromise ??= import('../../../vendor/cyberchef/src/core/config/OperationConfig.json')
    .then(module => module.default as unknown as Record<string, OperationConfig>);
  return configPromise;
}

/**
 * Les listes d'options contiennent des intertitres de groupe, « [Hash] » et
 * « [/Hash] » : ce ne sont pas des choix.
 */
export function isSubheading(entry: unknown) {
  return typeof entry === 'string' && /^\[[\s\S]*\]$/.test(entry);
}

/** Options sélectionnables d'un argument de type option, intertitres exclus. */
export function selectableOptions(arg: ArgConfig): string[] {
  return (arg.value as string[]).filter(entry => !isSubheading(entry));
}

/**
 * Valeur par défaut d'un argument, au format attendu par une recette — la même
 * logique que l'API Node de CyberChef (src/node/api.mjs).
 */
export function defaultArgValue(arg: ArgConfig): unknown {
  const index = arg.defaultIndex ?? 0;

  switch (arg.type) {
    case 'option': {
      if (!Array.isArray(arg.value)) return arg.value;
      // defaultIndex compte les intertitres : on indexe la liste brute, puis on
      // saute un éventuel intertitre.
      const raw = arg.value as string[];
      const picked = raw.slice(index).find(entry => !isSubheading(entry));
      return picked ?? selectableOptions(arg)[0] ?? '';
    }

    case 'editableOption':
    case 'editableOptionShort':
      if (!Array.isArray(arg.value)) return arg.value;
      return (arg.value as NamedValue<string>[])[index]?.value ?? '';

    case 'argSelector':
    case 'populateOption':
    case 'populateMultiOption':
      if (!Array.isArray(arg.value)) return arg.value;
      return (arg.value as NamedValue[]).filter(entry => !isSubheading(entry.name))[index]?.name
        ?? (arg.value as NamedValue[])[0]?.name ?? '';

    case 'toggleString':
      return { string: (arg.value as string) ?? '', option: arg.toggleValues?.[0] ?? '' } satisfies ToggleString;

    default:
      return arg.value;
  }
}

/**
 * Préremplit les cibles des sélecteurs populateOption, comme l'interface de
 * CyberChef au chargement. `onlyIfEmpty` : ne touche pas une cible déjà remplie
 * (valeur personnalisée d'une recette importée, par exemple).
 */
export function applyPopulate(
  values: unknown[],
  target: number | number[],
  value: unknown,
  { onlyIfEmpty = false } = {},
) {
  const targets = Array.isArray(target) ? target : [target];
  const payload = Array.isArray(target) && Array.isArray(value) ? value : [value];
  targets.forEach((index, position) => {
    if (onlyIfEmpty && values[index] !== '' && values[index] !== undefined) return;
    values[index] = payload[position];
  });
}

/**
 * Arguments prêts à l'emploi : ceux fournis (recette importée, lien partagé),
 * complétés par les valeurs par défaut là où ils manquent, puis préremplis.
 */
export function completeArgs(config: OperationConfig, provided: unknown[] = []): unknown[] {
  const values = config.args.map((arg, index) => (index < provided.length ? provided[index] : defaultArgValue(arg)));

  config.args.forEach((arg, index) => {
    if (arg.type !== 'populateOption' && arg.type !== 'populateMultiOption') return;
    const choice = (arg.value as NamedValue[]).find(entry => entry.name === values[index]);
    if (choice) applyPopulate(values, arg.target!, choice.value, { onlyIfEmpty: true });
  });

  return values;
}

/**
 * Arguments désactivés : ceux déclarés comme tels, plus ceux qu'un sélecteur
 * d'arguments (argSelector) coupe selon le choix courant.
 */
export function disabledArgs(config: OperationConfig, values: unknown[]): Set<number> {
  const disabled = new Set<number>();
  config.args.forEach((arg, index) => {
    if (arg.disabled) disabled.add(index);
  });
  config.args.forEach((arg, index) => {
    if (arg.type !== 'argSelector') return;
    const choice = (arg.value as NamedValue[]).find(entry => entry.name === values[index]);
    choice?.off?.forEach(i => disabled.add(i));
    choice?.on?.forEach(i => disabled.delete(i));
  });
  return disabled;
}
