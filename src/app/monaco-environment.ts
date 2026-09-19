/**
 * Workers de Monaco, l'éditeur qu'IT-Tools emploie pour le comparateur de texte.
 *
 * IT-Tools ne les configure pas : Monaco retombe alors sur une exécution dans le
 * fil principal (il le signale en console), et un gros diff peut figer
 * l'interface. On fournit le worker de base de l'éditeur, le seul qu'un diff en
 * texte brut sollicite.
 *
 * Coût : le constructeur tient en quelques octets ; le script du worker n'est
 * téléchargé qu'à la première ouverture d'un éditeur Monaco.
 */
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

(self as unknown as { MonacoEnvironment: { getWorker: () => Worker } }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
